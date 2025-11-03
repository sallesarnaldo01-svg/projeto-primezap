import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { z } from 'zod';
import type { JWTPayload } from '@primeflow/shared/types';
import type { contacts, contact_activities, deals, Prisma } from '@prisma/client';

type AuthenticatedRequest = Request & { user?: JWTPayload };

const contactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(5, 'Telefone inválido').optional(),
  email: z.string().email('Email inválido').optional(),
  tags: z.array(z.string()).optional(),
  origin: z.string().optional(),
  leadStatus: z.string().optional(),
  notes: z.string().optional(),
});

const partialContactSchema = contactSchema.partial();

const toJsonObject = (value: Prisma.JsonValue | null | undefined): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};

function splitCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, ''));
}

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return [];
  }

  const headers = splitCSVLine(lines[0]).map((header) => header.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = splitCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() ?? '';
    });
    rows.push(row);
  }

  return rows;
}

function ensureAuthenticated(req: AuthenticatedRequest, res: Response): { userId: string; tenantId: string } | null {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }

  return { userId: req.user.userId, tenantId: req.user.tenantId };
}

function mapContact(contact: contacts & { _count?: { conversations: number } }) {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email ?? undefined,
    phone: contact.phone ?? undefined,
    avatar: contact.avatarUrl ?? undefined,
    tags: contact.tags ?? [],
    origin: contact.origin ?? undefined,
    origem: contact.origin ?? undefined,
    leadStatus: contact.leadStatus ?? undefined,
    createdAt: contact.createdAt?.toISOString() ?? null,
    updatedAt: contact.updatedAt?.toISOString() ?? null,
    lastInteractionAt: contact.lastInteractionAt?.toISOString() ?? null,
    _count: contact._count,
  };
}

function mapActivity(activity: contact_activities & { user?: { id: string; name: string; email: string } | null }) {
  return {
    id: activity.id,
    contactId: activity.contactId,
    type: activity.type,
    description: activity.description ?? undefined,
    metadata: activity.metadata ?? undefined,
    createdAt: activity.createdAt?.toISOString() ?? null,
    user: activity.user
      ? {
          id: activity.user.id,
          name: activity.user.name,
          email: activity.user.email,
        }
      : undefined,
  };
}

function mapDeal(deal: deals & { stages?: { name: string } | null }) {
  return {
    id: deal.id,
    title: deal.title,
    value: deal.value ? Number(deal.value) : 0,
    stage: deal.stages?.name,
    probability: deal.probability ?? 0,
    expectedCloseDate: deal.expectedCloseDate?.toISOString() ?? null,
    createdAt: deal.createdAt?.toISOString() ?? null,
    updatedAt: deal.updatedAt?.toISOString() ?? null,
  };
}

export async function getContacts(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const {
      search,
      tag,
      tags,
      origem,
      leadStatus,
      page = '1',
      limit = '50',
      order = 'desc',
    } = req.query;

    const parsedPage = Math.max(parseInt(page as string, 10) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit as string, 10) || 50, 1), 200);
    const skip = (parsedPage - 1) * parsedLimit;

    const where: Prisma.contactsWhereInput = {
      tenantId: auth.tenantId,
    };

    const searchTerm = typeof search === 'string' ? search.trim() : undefined;
    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const tagParam = typeof tag === 'string' ? [tag] : undefined;
    const tagsQuery =
      typeof tags === 'string'
        ? tags
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : undefined;

    const tagsFilter = tagsQuery ?? tagParam;
    if (tagsFilter && tagsFilter.length > 0) {
      where.tags = { hasSome: tagsFilter };
    }

    if (typeof origem === 'string' && origem.trim()) {
      where.origin = origem.trim();
    }

    if (typeof leadStatus === 'string' && leadStatus.trim()) {
      where.leadStatus = leadStatus.trim();
    }

    const [items, total] = await Promise.all([
      prisma.contacts.findMany({
        where,
        include: {
          _count: {
            select: { conversations: true },
          },
        },
        orderBy: { createdAt: order === 'asc' ? 'asc' : 'desc' },
        skip,
        take: parsedLimit,
      }),
      prisma.contacts.count({ where }),
    ]);

    res.json({
      contacts: items.map(mapContact),
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching contacts');
    res.status(500).json({ error: 'Erro ao buscar contatos', message: error.message });
  }
}

export async function getContact(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;

    const contact = await prisma.contacts.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        conversations: {
          orderBy: { updatedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            status: true,
            lastMessageAt: true,
            lastMessageContent: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        deals: {
          orderBy: { createdAt: 'desc' },
          include: {
            stages: {
              select: { name: true },
            },
          },
        },
        _count: {
          select: {
            conversations: true,
          },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    res.json({
      ...mapContact(contact),
      conversations: contact.conversations.map((conversation) => ({
        id: conversation.id,
        status: conversation.status ?? 'active',
        lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
        lastMessageContent: conversation.lastMessageContent ?? undefined,
        createdAt: conversation.createdAt?.toISOString() ?? null,
        updatedAt: conversation.updatedAt?.toISOString() ?? null,
      })),
      deals: contact.deals.map(mapDeal),
      activities: contact.activities.map(mapActivity),
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching contact');
    res.status(500).json({ error: 'Erro ao buscar contato', message: error.message });
  }
}

export async function createContact(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const data = contactSchema.parse({ ...req.body, origin: req.body.origin ?? req.body.origem });

    const existing = await prisma.contacts.findFirst({
      where: {
        tenantId: auth.tenantId,
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
    });

    if (existing) {
      return res.status(409).json({ error: 'Contato já existe com este email ou telefone' });
    }

    const origin = data.origin ?? 'manual';

    const contact = await prisma.contacts.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        tags: data.tags ?? [],
        origin,
        leadStatus: data.leadStatus ?? 'novo',
        metadata: data.notes ? { notes: data.notes } : {},
        userId: auth.userId,
        tenantId: auth.tenantId,
      },
    });

    await prisma.contact_activities.create({
      data: {
        contactId: contact.id,
        userId: auth.userId,
        type: 'created',
        description: `Contato "${contact.name}" criado`,
      },
    });

    logger.info({ contactId: contact.id }, 'Contact created');
    res.status(201).json(mapContact({ ...contact, _count: { conversations: 0 } }));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error creating contact');
    res.status(500).json({ error: 'Erro ao criar contato', message: error.message });
  }
}

export async function updateContact(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;
    const updates = partialContactSchema.parse({ ...req.body, origin: req.body.origin ?? req.body.origem });

    const existing = await prisma.contacts.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const metadata = toJsonObject(existing.metadata);
    if (updates.notes !== undefined) {
      metadata.notes = updates.notes;
    }

    const contact = await prisma.contacts.update({
      where: { id },
      data: {
        ...(updates.name !== undefined ? { name: updates.name } : {}),
        ...(updates.email !== undefined ? { email: updates.email } : {}),
        ...(updates.phone !== undefined ? { phone: updates.phone } : {}),
        ...(updates.tags !== undefined ? { tags: updates.tags } : {}),
        ...(updates.origin !== undefined ? { origin: updates.origin } : {}),
        ...(updates.leadStatus !== undefined ? { leadStatus: updates.leadStatus } : {}),
        ...(updates.notes !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}),
        updatedAt: new Date(),
      },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    await prisma.contact_activities.create({
      data: {
        contactId: id,
        userId: auth.userId,
        type: 'updated',
        description: `Contato "${contact.name}" atualizado`,
        metadata: { changes: Object.keys(req.body ?? {}) },
      },
    });

    logger.info({ contactId: id }, 'Contact updated');
    res.json(mapContact(contact));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error updating contact');
    res.status(500).json({ error: 'Erro ao atualizar contato', message: error.message });
  }
}

export async function deleteContact(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;

    const contact = await prisma.contacts.findFirst({
      where: { id, tenantId: auth.tenantId },
      include: {
        _count: {
          select: { conversations: true },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    if (contact._count?.conversations && contact._count.conversations > 0) {
      return res.status(409).json({
        error: 'Não é possível deletar contato com conversas associadas',
        counts: contact._count,
      });
    }

    await prisma.contact_activities.deleteMany({ where: { contactId: id } });
    await prisma.contacts.delete({ where: { id } });

    logger.info({ contactId: id }, 'Contact deleted');
    res.json({ success: true, message: 'Contato deletado com sucesso' });
  } catch (error: any) {
    logger.error({ error }, 'Error deleting contact');
    res.status(500).json({ error: 'Erro ao deletar contato', message: error.message });
  }
}

export async function addTags(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags devem ser um array não vazio' });
    }

    const contact = await prisma.contacts.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const updatedTags = Array.from(new Set([...(contact.tags ?? []), ...tags]));

    const updated = await prisma.contacts.update({
      where: { id },
      data: { tags: updatedTags, updatedAt: new Date() },
      include: {
        _count: { select: { conversations: true } },
      },
    });

    res.json(mapContact(updated));
  } catch (error: any) {
    logger.error({ error }, 'Error adding tags');
    res.status(500).json({ error: 'Erro ao adicionar tags', message: error.message });
  }
}

export async function removeTags(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Tags devem ser um array não vazio' });
    }

    const contact = await prisma.contacts.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const updatedTags = (contact.tags ?? []).filter((tag: string) => !tags.includes(tag));

    const updated = await prisma.contacts.update({
      where: { id },
      data: { tags: updatedTags, updatedAt: new Date() },
      include: {
        _count: { select: { conversations: true } },
      },
    });

    res.json(mapContact(updated));
  } catch (error: any) {
    logger.error({ error }, 'Error removing tags');
    res.status(500).json({ error: 'Erro ao remover tags', message: error.message });
  }
}

export async function importContacts(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const csvContent = file.buffer.toString('utf-8');
    const rows = parseCSV(csvContent);
    let imported = 0;
    let failed = 0;
    const errors: Array<{ row: Record<string, string>; reason: string }> = [];

    for (const row of rows) {
      try {
        if (!row.name) {
          throw new Error('Nome obrigatório');
        }

        const phone = row.phone?.trim() || undefined;
        const email = row.email?.trim() || undefined;
        const tags = row.tags ? row.tags.split(',').map((value) => value.trim()).filter(Boolean) : [];
        const origin = row.origem?.trim() || row.origin?.trim() || 'importacao';
        const leadStatus = row.leadStatus?.trim() || 'novo';

        const existing = await prisma.contacts.findFirst({
          where: {
            tenantId: auth.tenantId,
            OR: [
              ...(phone ? [{ phone }] : []),
              ...(email ? [{ email }] : []),
            ],
          },
        });

        if (existing) {
          await prisma.contacts.update({
            where: { id: existing.id },
            data: {
              name: row.name.trim(),
              email,
              phone,
              tags,
              origin,
              leadStatus,
              updatedAt: new Date(),
            },
          });
        } else {
          await prisma.contacts.create({
            data: {
              name: row.name.trim(),
              email,
              phone,
              tags,
              origin,
              leadStatus,
              userId: auth.userId,
              tenantId: auth.tenantId,
            },
          });
        }

        imported += 1;
      } catch (error: any) {
        failed += 1;
        errors.push({ row, reason: error.message });
      }
    }

    res.json({
      success: true,
      imported,
      failed,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error importing CSV');
    res.status(500).json({ error: 'Erro ao importar contatos', message: error.message });
  }
}

export async function getTimeline(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id } = req.params;

    const contact = await prisma.contacts.findFirst({
      where: { id, tenantId: auth.tenantId },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    const activities = await prisma.contact_activities.findMany({
      where: { contactId: id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json(activities.map(mapActivity));
  } catch (error: any) {
    logger.error({ error }, 'Error retrieving timeline');
    res.status(500).json({ error: 'Erro ao buscar timeline', message: error.message });
  }
}

export async function getStats(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const baseWhere: Prisma.contactsWhereInput = { tenantId: auth.tenantId };

    const [total, leads, qualificados, convertidos] = await Promise.all([
      prisma.contacts.count({ where: baseWhere }),
      prisma.contacts.count({
        where: { ...baseWhere, leadStatus: { equals: 'lead', mode: 'insensitive' } },
      }),
      prisma.contacts.count({
        where: { ...baseWhere, leadStatus: { equals: 'qualificado', mode: 'insensitive' } },
      }),
      prisma.contacts.count({
        where: { ...baseWhere, leadStatus: { equals: 'convertido', mode: 'insensitive' } },
      }),
    ]);

    res.json({
      total,
      leads,
      qualificados,
      convertidos,
      taxaQualificacao: leads > 0 ? (qualificados / leads) * 100 : 0,
      taxaConversao: qualificados > 0 ? (convertidos / qualificados) * 100 : 0,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching contact stats');
    res.status(500).json({ error: 'Erro ao buscar estatísticas', message: error.message });
  }
}
