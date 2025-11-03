import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { AuthRequest } from '../middleware/auth.js';

type DealStage =
  | 'LEAD'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

const DEAL_STAGES: DealStage[] = [
  'LEAD',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST',
];

const DEFAULT_STAGE = 'LEAD' satisfies DealStage;

const NORMALIZE_STAGE_REGEX: Array<{ match: RegExp; stage: DealStage }> = [
  { match: /GANH|WON|FECHADO\s*GANHO/i, stage: 'CLOSED_WON' },
  { match: /PERD|LOST|FECHADO\s*PERDIDO/i, stage: 'CLOSED_LOST' },
  { match: /NEGOCIA|NEGOTIATION/i, stage: 'NEGOTIATION' },
  { match: /PROP|PROPOS/i, stage: 'PROPOSAL' },
  { match: /QUALI/i, stage: 'QUALIFIED' },
  { match: /LEAD|NOVO|INÍCIO|INICIO/i, stage: 'LEAD' },
];

const toJsonObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

const normalizeStageName = (value?: string | null): DealStage => {
  if (!value) return DEFAULT_STAGE;

  for (const { match, stage } of NORMALIZE_STAGE_REGEX) {
    if (match.test(value)) {
      return stage;
    }
  }

  const upper = value.trim().toUpperCase().replace(/\s+/g, '_');
  if (DEAL_STAGES.includes(upper as DealStage)) {
    return upper as DealStage;
  }

  return DEFAULT_STAGE;
};

const ensureTenant = (req: AuthRequest) => {
  const tenantId = req.user?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant não identificado');
  }
  return tenantId;
};

const loadStageMappings = async (tenantId: string) => {
  const stages = await prisma.stages.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });

  const byId = new Map<string, DealStage>();
  stages.forEach((stage) => {
    byId.set(stage.id, normalizeStageName(stage.name));
  });

  return {
    byId,
    findIdsByStage(target: DealStage) {
      return stages.filter((item) => byId.get(item.id) === target).map((item) => item.id);
    },
    guessStageId(target: DealStage) {
      return stages.find((item) => byId.get(item.id) === target)?.id ?? null;
    },
  };
};

type DealWithRelations = Prisma.dealsGetPayload<{
  include: {
    contact: {
      select: {
        id: true;
        name: true;
        email: true | null;
        phone: true | null;
        avatarUrl: true | null;
        _count: { select: { deals: true } };
      };
    };
    owner: {
      select: {
        id: true;
        name: true;
        email: true;
        avatar: true | null;
      };
    };
    stages: {
      select: {
        id: true;
        name: true;
      };
    };
  };
}>;

const mapDeal = (
  deal: DealWithRelations,
  stageMap: Map<string, DealStage>,
): {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  expectedCloseDate: string | null;
  closedAt: string | null;
  notes: string | null;
  contactId: string | null;
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string | null;
    _count?: { deals: number };
  };
  assignedToId: string | null;
  assignedTo?: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
} => {
  const stageId = deal.stageId ?? deal.stages?.id ?? '';
  const stageName = deal.stages?.name;
  if (stageName) {
    stageMap.set(stageId, normalizeStageName(stageName));
  }

  const stage = stageMap.get(stageId) ?? DEFAULT_STAGE;

  return {
    id: deal.id,
    title: deal.title,
    value: deal.value ? Number(deal.value) : 0,
    stage,
    expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
    closedAt: deal.closedAt?.toISOString() ?? null,
    notes: deal.notes ?? null,
    contactId: deal.contactId ?? null,
    contact: deal.contact
      ? {
          id: deal.contact.id,
          name: deal.contact.name,
          email: deal.contact.email ?? undefined,
          phone: deal.contact.phone ?? undefined,
          avatar: deal.contact.avatarUrl ?? null,
          _count: deal.contact._count,
        }
      : undefined,
    assignedToId: deal.ownerId ?? null,
    assignedTo: deal.owner
      ? {
          id: deal.owner.id,
          name: deal.owner.name,
          email: deal.owner.email,
          avatar: deal.owner.avatar ?? null,
        }
      : null,
    createdAt: deal.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: deal.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
};

const parsePagination = (pageParam: unknown, limitParam: unknown) => {
  const page = Math.max(parseInt(pageParam as string, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(limitParam as string, 10) || 50, 1), 200);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

export async function getDeals(req: AuthRequest, res: Response) {
  try {
    const tenantId = ensureTenant(req);
    const { stage, search, page = '1', limit = '50' } = req.query;
    const { page: pageNumber, limit: limitNumber, skip } = parsePagination(page, limit);

    const stageMappings = await loadStageMappings(tenantId);
    const where: Prisma.dealsWhereInput = {
      tenantId,
    };

    if (typeof stage === 'string' && stage.trim().length > 0) {
      const normalizedStage = normalizeStageName(stage);
      const matchingStageIds = stageMappings.findIdsByStage(normalizedStage);

      if (matchingStageIds.length === 0) {
        return res.json({
          deals: [],
          pagination: {
            page: pageNumber,
            limit: limitNumber,
            total: 0,
            pages: 0,
          },
        });
      }

      where.stageId =
        matchingStageIds.length === 1 ? matchingStageIds[0] : { in: matchingStageIds };
    }

    if (typeof search === 'string' && search.trim().length > 0) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { notes: { contains: term, mode: 'insensitive' } },
        {
          contact: {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term } },
            ],
          },
        },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.deals.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              avatarUrl: true,
              _count: { select: { deals: true } },
            },
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          stages: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNumber,
      }),
      prisma.deals.count({ where }),
    ]);

    const deals = items.map((deal) => mapDeal(deal, stageMappings.byId));

    res.json({
      deals,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(total / limitNumber),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching deals');
    res.status(500).json({ error: 'Erro ao buscar deals' });
  }
}

export async function createDeal(req: AuthRequest, res: Response) {
  try {
    const tenantId = ensureTenant(req);
    const userId = req.user?.userId ?? req.user?.id ?? null;
    const { title, contactId, value, stage, expectedCloseDate, notes } = req.body;

    if (!title || !contactId) {
      return res.status(400).json({ error: 'Título e contato são obrigatórios' });
    }

    const stageMappings = await loadStageMappings(tenantId);
    const normalizedStage = normalizeStageName(stage);
    const stageId = stageMappings.guessStageId(normalizedStage);

    const deal = await prisma.deals.create({
      data: {
        tenantId,
        contactId,
        ownerId: userId,
        title: title.trim(),
        value: value !== undefined ? new Prisma.Decimal(value) : new Prisma.Decimal(0),
        stageId: stageId ?? undefined,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        notes: notes ?? null,
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            _count: { select: { deals: true } },
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        stages: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

  logger.info({ dealId: deal.id, tenantId, title }, 'Deal created');
    res.status(201).json(mapDeal(deal, stageMappings.byId));
  } catch (error) {
    logger.error({ error }, 'Error creating deal');
    res.status(500).json({ error: 'Erro ao criar deal' });
  }
}

export async function updateDeal(req: AuthRequest, res: Response) {
  try {
    const tenantId = ensureTenant(req);
    const { id } = req.params;
    const { title, value, stage, expectedCloseDate, notes, assignedToId } = req.body;

    const existingDeal = await prisma.deals.findFirst({
      where: { id, tenantId },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    const data: Prisma.dealsUncheckedUpdateInput = {
      updatedAt: new Date(),
    };

    if (title) data.title = title.trim();
    if (value !== undefined) data.value = new Prisma.Decimal(value);
    if (expectedCloseDate !== undefined) {
      data.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    }
    if (notes !== undefined) data.notes = notes;
    if (assignedToId !== undefined) data.ownerId = assignedToId ?? null;

    if (stage) {
      const stageMappings = await loadStageMappings(tenantId);
      const normalizedStage = normalizeStageName(stage);
      data.stageId = stageMappings.guessStageId(normalizedStage);
    }

    const updated = await prisma.deals.update({
      where: { id },
      data,
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            _count: { select: { deals: true } },
          },
        },
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        stages: {
          select: { id: true, name: true },
        },
      },
    });

    const stageMappings = await loadStageMappings(tenantId);
    res.json(mapDeal(updated, stageMappings.byId));
  } catch (error) {
    logger.error({ error }, 'Error updating deal');
    res.status(500).json({ error: 'Erro ao atualizar deal' });
  }
}

export async function updateDealStage(req: AuthRequest, res: Response) {
  try {
    const tenantId = ensureTenant(req);
    const { id } = req.params;
    const { stage } = req.body as { stage?: DealStage };

    if (!stage) {
      return res.status(400).json({ error: 'Estágio é obrigatório' });
    }

    const existingDeal = await prisma.deals.findFirst({
      where: { id, tenantId },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    const stageMappings = await loadStageMappings(tenantId);
    const normalizedStage = normalizeStageName(stage);
    const stageId = stageMappings.guessStageId(normalizedStage);

    const updated = await prisma.deals.update({
      where: { id },
      data: {
        stageId,
        updatedAt: new Date(),
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            _count: { select: { deals: true } },
          },
        },
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        stages: {
          select: { id: true, name: true },
        },
      },
    });

    res.json(mapDeal(updated, stageMappings.byId));
  } catch (error) {
    logger.error({ error }, 'Error updating deal stage');
    res.status(500).json({ error: 'Erro ao mover deal' });
  }
}

export async function deleteDeal(req: AuthRequest, res: Response) {
  try {
    const tenantId = ensureTenant(req);
    const { id } = req.params;

    const existingDeal = await prisma.deals.findFirst({
      where: { id, tenantId },
    });

    if (!existingDeal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    await prisma.deals.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    logger.error({ error }, 'Error deleting deal');
    res.status(500).json({ error: 'Erro ao remover deal' });
  }
}

export async function getPipeline(req: AuthRequest, res: Response) {
  try {
    const tenantId = ensureTenant(req);
    const stageMappings = await loadStageMappings(tenantId);

    const deals = await prisma.deals.findMany({
      where: { tenantId },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            avatarUrl: true,
            _count: { select: { deals: true } },
          },
        },
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        stages: {
          select: { id: true, name: true },
        },
      },
    });

    const pipeline = DEAL_STAGES.reduce<Record<DealStage, ReturnType<typeof mapDeal>[]>>(
      (acc, stage) => {
        acc[stage] = [];
        return acc;
      },
      {} as Record<DealStage, ReturnType<typeof mapDeal>[]>,
    );

    deals.forEach((deal) => {
      const mapped = mapDeal(deal, stageMappings.byId);
      pipeline[mapped.stage].push(mapped);
    });

    res.json(pipeline);
  } catch (error) {
    logger.error({ error }, 'Error fetching pipeline data');
    res.status(500).json({ error: 'Erro ao buscar pipeline' });
  }
}
