import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import type { JWTPayload } from '@primeflow/shared/types';
import type { deals, deal_history } from '@prisma/client';

type AuthenticatedRequest = Request & { user?: JWTPayload };

const toJsonObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

const dealSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  value: z.number().min(0).optional(),
  stageId: z.string().uuid().optional(),
  stage: z.string().optional(),
  contactId: z.string().uuid('ID de contato inválido').optional(),
  ownerId: z.string().uuid().optional(),
  expectedCloseDate: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

const partialDealSchema = dealSchema.partial();

function ensureAuthenticated(req: AuthenticatedRequest, res: Response): { userId: string; tenantId: string } | null {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }

  return { userId: req.user.userId, tenantId: req.user.tenantId };
}

function mapDeal(deal: deals & {
  stages?: { id: string; name: string; color?: string | null } | null;
  contact?: { id: string; name: string; email?: string | null; phone?: string | null } | null;
  owner?: { id: string; name: string; email?: string | null } | null;
}) {
  return {
    id: deal.id,
    title: deal.title,
    value: deal.value ? Number(deal.value) : 0,
    probability: deal.probability ?? 0,
    stageId: deal.stageId ?? undefined,
    stage: deal.stages ? { id: deal.stages.id, name: deal.stages.name, color: deal.stages.color ?? undefined } : undefined,
    contact: deal.contact
      ? {
          id: deal.contact.id,
          name: deal.contact.name,
          email: deal.contact.email ?? undefined,
          phone: deal.contact.phone ?? undefined,
        }
      : undefined,
    owner: deal.owner
      ? {
          id: deal.owner.id,
          name: deal.owner.name,
          email: deal.owner.email ?? undefined,
        }
      : undefined,
    expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
    createdAt: deal.createdAt?.toISOString() ?? null,
    updatedAt: deal.updatedAt?.toISOString() ?? null,
  };
}

function mapHistory(history: deal_history & { user?: { id: string; name: string; email: string } | null }) {
  return {
    id: history.id,
    dealId: history.dealId,
    action: history.action,
    oldValue: history.oldValue ?? undefined,
    newValue: history.newValue ?? undefined,
    metadata: history.metadata ?? undefined,
    createdAt: history.createdAt?.toISOString() ?? null,
    user: history.user
      ? {
          id: history.user.id,
          name: history.user.name,
          email: history.user.email,
        }
      : undefined,
  };
}

async function resolveStage(tenantId: string, stageId?: string, stageName?: string) {
  if (stageId) {
    const stage = await prisma.stages.findFirst({
      where: { id: stageId, tenantId },
    });
    if (stage) return stage;
  }

  if (stageName) {
    const stage = await prisma.stages.findFirst({
      where: {
        tenantId,
        name: { equals: stageName, mode: 'insensitive' },
      },
    });
    if (stage) return stage;
  }

  return null;
}

async function ensureStage(tenantId: string, stageId?: string, stageName?: string) {
  const stage = await resolveStage(tenantId, stageId, stageName);
  if (!stage) {
    throw new Error('Estágio não encontrado para o tenant atual');
  }
  return stage;
}

export async function listDeals(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { stage, stageId, userId, contactId, minValue, maxValue, search } = req.query;

    const where: Prisma.dealsWhereInput = {
      tenantId: auth.tenantId,
    };

    if (typeof stageId === 'string' && stageId) {
      where.stageId = stageId;
    } else if (typeof stage === 'string' && stage) {
      const resolved = await resolveStage(auth.tenantId, undefined, stage);
      if (resolved) {
        where.stageId = resolved.id;
      }
    }

    if (typeof userId === 'string' && userId) {
      where.ownerId = userId;
    }

    if (typeof contactId === 'string' && contactId) {
      where.contactId = contactId;
    }

    if (typeof minValue === 'string' && !Number.isNaN(Number(minValue))) {
      const minDecimal = new Prisma.Decimal(Number(minValue));
      const valueFilter = (where.value ?? {}) as Prisma.DecimalNullableFilter;
      valueFilter.gte = minDecimal;
      where.value = valueFilter;
    }

    if (typeof maxValue === 'string' && !Number.isNaN(Number(maxValue))) {
      const maxDecimal = new Prisma.Decimal(Number(maxValue));
      const valueFilter = (where.value ?? {}) as Prisma.DecimalNullableFilter;
      valueFilter.lte = maxDecimal;
      where.value = valueFilter;
    }

    if (typeof search === 'string' && search.trim()) {
      const value = search.trim();
      where.OR = [
        { title: { contains: value, mode: 'insensitive' } },
        {
          contact: {
            name: { contains: value, mode: 'insensitive' },
          },
        },
      ];
    }

    const deals = await prisma.deals.findMany({
      where,
      include: {
        stages: { select: { id: true, name: true, color: true } },
        contact: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(deals.map(mapDeal));
  } catch (error: any) {
    logger.error({ error }, 'Error listing deals');
    res.status(500).json({ error: 'Erro ao listar deals', message: error.message });
  }
}

export async function getDealsByStage(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const stages = await prisma.stages.findMany({
      where: { tenantId: auth.tenantId },
      orderBy: { displayOrder: 'asc' },
    });

    const deals = await prisma.deals.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        stages: { select: { id: true, name: true, color: true } },
        contact: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const grouped: Record<string, ReturnType<typeof mapDeal>[]> = {};

    for (const stage of stages) {
      grouped[stage.name] = [];
    }

    for (const deal of deals) {
      const stageName = deal.stages?.name ?? 'Sem estágio';
      if (!grouped[stageName]) {
        grouped[stageName] = [];
      }
      grouped[stageName].push(mapDeal(deal));
    }

    res.json(grouped);
  } catch (error: any) {
    logger.error({ error }, 'Error grouping deals by stage');
    res.status(500).json({ error: 'Erro ao agrupar deals por estágio', message: error.message });
  }
}

export async function getDeal(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;

    const deal = await prisma.deals.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        stages: { select: { id: true, name: true, color: true } },
        contact: { select: { id: true, name: true, email: true, phone: true, avatarUrl: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    res.json(mapDeal(deal));
  } catch (error: any) {
    logger.error({ error }, 'Error fetching deal');
    res.status(500).json({ error: 'Erro ao buscar deal', message: error.message });
  }
}

export async function createDeal(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = dealSchema.parse(req.body);

    const stage = await ensureStage(auth.tenantId, payload.stageId, payload.stage);

    if (payload.contactId) {
      const contact = await prisma.contacts.findFirst({
        where: { id: payload.contactId, tenantId: auth.tenantId },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }
    }

    const deal = await prisma.deals.create({
      data: {
        title: payload.title,
        value: payload.value !== undefined ? new Prisma.Decimal(payload.value) : new Prisma.Decimal(0),
        stageId: stage.id,
        tenantId: auth.tenantId,
        ownerId: payload.ownerId ?? auth.userId,
        contactId: payload.contactId ?? null,
        probability: payload.probability ?? 0,
        expectedCloseDate: payload.expectedCloseDate ? new Date(payload.expectedCloseDate) : null,
        customData: payload.notes ? { notes: payload.notes } : {},
      },
      include: {
        stages: { select: { id: true, name: true, color: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.deal_history.create({
      data: {
        dealId: deal.id,
        userId: auth.userId,
        action: 'created',
        newValue: stage.name,
      },
    });

    res.status(201).json(mapDeal(deal));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error creating deal');
    res.status(500).json({ error: 'Erro ao criar deal', message: error.message });
  }
}

export async function updateDeal(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;
    const payload = partialDealSchema.parse(req.body);

    const deal = await prisma.deals.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    let stageId = deal.stageId;
    if (payload.stageId || payload.stage) {
      const stage = await ensureStage(auth.tenantId, payload.stageId, payload.stage);
      stageId = stage.id;

      await prisma.deal_history.create({
        data: {
          dealId: id,
          userId: auth.userId,
          action: 'stage_changed',
          oldValue: deal.stageId ?? undefined,
          newValue: stage.id,
        },
      });
    }

    const updated = await prisma.deals.update({
      where: { id },
      data: {
        title: payload.title ?? deal.title,
        value: payload.value !== undefined ? new Prisma.Decimal(payload.value) : deal.value,
        stageId,
        ownerId: payload.ownerId ?? deal.ownerId,
        contactId: payload.contactId ?? deal.contactId,
        probability: payload.probability ?? deal.probability ?? 0,
        expectedCloseDate: payload.expectedCloseDate
          ? new Date(payload.expectedCloseDate)
          : deal.expectedCloseDate,
        ...(payload.notes !== undefined
          ? { customData: { ...toJsonObject(deal.customData), notes: payload.notes } as Prisma.InputJsonValue }
          : {}),
        updatedAt: new Date(),
      },
      include: {
        stages: { select: { id: true, name: true, color: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(mapDeal(updated));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error updating deal');
    res.status(500).json({ error: 'Erro ao atualizar deal', message: error.message });
  }
}

export async function updateStage(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;
    const { stageId, stage } = req.body as { stageId?: string; stage?: string };

    if (!stageId && !stage) {
      return res.status(400).json({ error: 'Estágio não fornecido' });
    }

    const deal = await prisma.deals.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    const resolvedStage = await ensureStage(auth.tenantId, stageId, stage);

    const updated = await prisma.deals.update({
      where: { id },
      data: {
        stageId: resolvedStage.id,
        probability: resolvedStage.isFinal ? 100 : deal.probability ?? 0,
        updatedAt: new Date(),
      },
      include: {
        stages: { select: { id: true, name: true, color: true } },
        contact: { select: { id: true, name: true, email: true, phone: true } },
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    await prisma.deal_history.create({
      data: {
        dealId: id,
        userId: auth.userId,
        action: 'stage_changed',
        oldValue: deal.stageId ?? undefined,
        newValue: resolvedStage.id,
      },
    });

    res.json(mapDeal(updated));
  } catch (error: any) {
    logger.error({ error }, 'Error updating deal stage');
    res.status(500).json({ error: 'Erro ao atualizar estágio', message: error.message });
  }
}

export async function deleteDeal(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;

    const deal = await prisma.deals.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    await prisma.deal_history.deleteMany({ where: { dealId: id } });
    await prisma.deals.delete({ where: { id } });

    res.json({ success: true, message: 'Deal deletado com sucesso' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting deal');
    res.status(500).json({ error: 'Erro ao deletar deal', message: error.message });
  }
}

export async function bulkAIAction(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { dealIds, command } = req.body as { dealIds?: string[]; command?: string };

    if (!Array.isArray(dealIds) || dealIds.length === 0) {
      return res.status(400).json({ error: 'IDs de deals não fornecidos' });
    }

    if (!command) {
      return res.status(400).json({ error: 'Comando não fornecido' });
    }

    // Placeholder para integração futura com fila/BullMQ
    const results = dealIds.map((dealId: string) => ({
      dealId,
      status: 'queued',
    }));

    res.json({
      success: true,
      total: dealIds.length,
      queued: dealIds.length,
      results,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error processing bulk AI action');
    res.status(500).json({ error: 'Erro ao enfileirar ação em massa', message: error.message });
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const baseWhere: Prisma.dealsWhereInput = { tenantId: auth.tenantId };

    const [total, ganhos, perdidos, totalValue, ganhosValue] = await Promise.all([
      prisma.deals.count({ where: baseWhere }),
      prisma.deals.count({ where: { ...baseWhere, stages: { isFinal: true } } }),
      prisma.deals.count({
        where: {
          ...baseWhere,
          stages: { isFinal: true },
          closedAt: { not: null },
        },
      }),
      prisma.deals.aggregate({
        where: baseWhere,
        _sum: { value: true },
      }),
      prisma.deals.aggregate({
        where: { ...baseWhere, stages: { isFinal: true } },
        _sum: { value: true },
      }),
    ]);

    res.json({
      total,
      totalValue: totalValue._sum.value ? Number(totalValue._sum.value) : 0,
      ganhos,
      ganhosValue: ganhosValue._sum.value ? Number(ganhosValue._sum.value) : 0,
      perdidos,
      taxaConversao: total > 0 ? (ganhos / total) * 100 : 0,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching deal stats');
    res.status(500).json({ error: 'Erro ao buscar estatísticas', message: error.message });
  }
}

export async function getHistory(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;

    const deal = await prisma.deals.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!deal) {
      return res.status(404).json({ error: 'Deal não encontrado' });
    }

    const history = await prisma.deal_history.findMany({
      where: { dealId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(history.map(mapHistory));
  } catch (error: any) {
    logger.error({ error }, 'Error fetching deal history');
    res.status(500).json({ error: 'Erro ao buscar histórico', message: error.message });
  }
}
