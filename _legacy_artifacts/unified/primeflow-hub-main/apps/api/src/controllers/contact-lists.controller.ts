import { Request, Response } from 'express';
import { z } from 'zod';
import type { JWTPayload } from '@primeflow/shared/types/index.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

type AuthenticatedRequest = Request & { user?: JWTPayload };

type ContactListWithMembers = Prisma.contact_listsGetPayload<{
  include: {
    members: {
      select: {
        id: true;
        contact_id: true;
        added_at: true;
        contact: {
          select: {
            id: true;
            name: true;
            email: true;
            phone: true;
            avatar_url: true;
          };
        };
      };
    };
  };
}>;

const listSchema = z.object({
  search: z.string().optional(),
  type: z.string().optional(),
  page: z
    .string()
    .optional()
    .transform((value) => (value ? Math.max(parseInt(value, 10) || 1, 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Math.min(Math.max(parseInt(value, 10) || 20, 1), 100) : 20)),
});

const createListSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['manual', 'dynamic', 'imported']).optional(),
  filterCriteria: z.record(z.any()).optional(),
});

const updateListSchema = createListSchema.partial();

const addMembersSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
});

function ensureAuthenticated(req: AuthenticatedRequest, res: Response) {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }

  return {
    tenantId: req.user.tenantId,
    userId: req.user.userId,
  };
}

function mapContactList(list: ContactListWithMembers) {
  return {
    id: list.id,
    name: list.name,
    description: list.description ?? undefined,
    type: list.type ?? 'manual',
    filterCriteria: list.filter_criteria ?? {},
    contactCount: list.contact_count ?? list.members.length,
    createdAt: list.created_at?.toISOString() ?? new Date().toISOString(),
    updatedAt: list.updated_at?.toISOString() ?? new Date().toISOString(),
    isActive: list.is_active ?? true,
    createdBy: list.created_by ?? undefined,
    members: list.members.map((member) => ({
      id: member.id,
      contactId: member.contact_id,
      addedAt: member.added_at?.toISOString() ?? new Date().toISOString(),
      contact: member.contact
        ? {
            id: member.contact.id,
            name: member.contact.name,
            email: member.contact.email ?? undefined,
            phone: member.contact.phone ?? undefined,
            avatar: member.contact.avatar_url ?? undefined,
          }
        : undefined,
    })),
  };
}

export async function listContactLists(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { search, type, page, limit } = listSchema.parse(req.query);

    const where: Prisma.contact_listsWhereInput = {
      tenant_id: auth.tenantId,
      is_active: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) {
      where.type = type;
    }

    const total = await prisma.contact_lists.count({ where });
    const lists = await prisma.contact_lists.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatar_url: true },
            },
          },
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      data: lists.map(mapContactList),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error listing contact lists');
    res.status(500).json({ error: 'Erro ao listar listas de contatos' });
  }
}

export async function getContactList(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const list = await prisma.contact_lists.findFirst({
      where: {
        id: req.params.id,
        tenant_id: auth.tenantId,
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatar_url: true },
            },
          },
        },
      },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    res.json(mapContactList(list));
  } catch (error) {
    logger.error({ error }, 'Error fetching contact list');
    res.status(500).json({ error: 'Erro ao buscar lista de contatos' });
  }
}

export async function createContactList(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = createListSchema.parse(req.body);

    const list = await prisma.contact_lists.create({
      data: {
        tenant_id: auth.tenantId,
        name: payload.name.trim(),
        description: payload.description ?? null,
        type: payload.type ?? 'manual',
        filter_criteria: payload.filterCriteria ?? {},
        created_by: auth.userId ?? null,
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatar_url: true },
            },
          },
        },
      },
    });

    res.status(201).json(mapContactList(list));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error creating contact list');
    res.status(500).json({ error: 'Erro ao criar lista de contatos' });
  }
}

export async function updateContactList(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = updateListSchema.parse(req.body);

    const list = await prisma.contact_lists.findFirst({
      where: {
        id: req.params.id,
        tenant_id: auth.tenantId,
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatar_url: true },
            },
          },
        },
      },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const updated = await prisma.contact_lists.update({
      where: { id: list.id },
      data: {
        name: payload.name?.trim() ?? list.name,
        description: payload.description ?? list.description,
        type: payload.type ?? list.type,
        filter_criteria: payload.filterCriteria ?? list.filter_criteria,
        updated_at: new Date(),
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatar_url: true },
            },
          },
        },
      },
    });

    res.json(mapContactList(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error updating contact list');
    res.status(500).json({ error: 'Erro ao atualizar lista de contatos' });
  }
}

export async function deleteContactList(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const list = await prisma.contact_lists.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    await prisma.contact_list_members.deleteMany({ where: { list_id: list.id } });
    await prisma.contact_lists.delete({ where: { id: list.id } });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error deleting contact list');
    res.status(500).json({ error: 'Erro ao deletar lista de contatos' });
  }
}

export async function addMembers(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = addMembersSchema.parse(req.body);

    const list = await prisma.contact_lists.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const contacts = await prisma.contacts.findMany({
      where: {
        tenant_id: auth.tenantId,
        id: { in: payload.contactIds },
      },
      select: { id: true },
    });

    if (contacts.length === 0) {
      return res.status(404).json({ error: 'Contatos não encontrados' });
    }

    const existingMembers = await prisma.contact_list_members.findMany({
      where: {
        list_id: list.id,
        contact_id: { in: contacts.map((contact) => contact.id) },
      },
      select: { contact_id: true },
    });

    const existingIds = new Set(existingMembers.map((member) => member.contact_id));

    const toInsert = contacts
      .filter((contact) => !existingIds.has(contact.id))
      .map((contact) => ({
        list_id: list.id,
        contact_id: contact.id,
      }));

    if (toInsert.length > 0) {
      await prisma.contact_list_members.createMany({ data: toInsert });
    }

    const updatedCount = await prisma.contact_list_members.count({ where: { list_id: list.id } });

    await prisma.contact_lists.update({
      where: { id: list.id },
      data: {
        contact_count: updatedCount,
        updated_at: new Date(),
      },
    });

    res.json({ success: true, added: toInsert.length, total: updatedCount });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error adding contacts to list');
    res.status(500).json({ error: 'Erro ao adicionar contatos à lista' });
  }
}

export async function removeMember(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id, memberId } = req.params as { id: string; memberId: string };

    const list = await prisma.contact_lists.findFirst({
      where: { id, tenant_id: auth.tenantId },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    await prisma.contact_list_members.deleteMany({
      where: {
        list_id: list.id,
        OR: [
          { id: memberId },
          { contact_id: memberId },
        ],
      },
    });

    const updatedCount = await prisma.contact_list_members.count({ where: { list_id: list.id } });
    await prisma.contact_lists.update({
      where: { id: list.id },
      data: { contact_count: updatedCount, updated_at: new Date() },
    });

    res.json({ success: true, total: updatedCount });
  } catch (error) {
    logger.error({ error }, 'Error removing contact from list');
    res.status(500).json({ error: 'Erro ao remover contato da lista' });
  }
}

export async function duplicateList(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const list = await prisma.contact_lists.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
      include: { members: true },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const duplicated = await prisma.contact_lists.create({
      data: {
        tenant_id: auth.tenantId,
        name: `${list.name} (cópia)`,
        description: list.description,
        type: list.type,
        filter_criteria: list.filter_criteria,
        contact_count: list.contact_count,
        created_by: auth.userId ?? list.created_by,
        members: {
          create: list.members.map((member) => ({
            contact_id: member.contact_id,
          })),
        },
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatar_url: true },
            },
          },
        },
      },
    });

    res.status(201).json(mapContactList(duplicated));
  } catch (error) {
    logger.error({ error }, 'Error duplicating contact list');
    res.status(500).json({ error: 'Erro ao duplicar lista de contatos' });
  }
}
