import { Request, Response } from 'express';
import { z } from 'zod';
import type { JWTPayload } from '@primeflow/shared/types';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

type AuthenticatedRequest = Request & { user?: JWTPayload };

type ContactListWithMembers = Prisma.contact_listsGetPayload<{
  include: {
    members: {
      select: {
        id: true;
        contactId: true;
        addedAt: true;
        contact: {
          select: {
            id: true;
            name: true;
            email: true;
            phone: true;
            avatarUrl: true;
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
    filterCriteria: list.filterCriteria ?? {},
    contactCount: list.contactCount ?? list.members.length,
    createdAt: list.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: list.updatedAt?.toISOString() ?? new Date().toISOString(),
    isActive: list.isActive ?? true,
    createdBy: list.createdBy ?? undefined,
    members: list.members.map((member) => ({
      id: member.id,
      contactId: member.contactId,
      addedAt: member.addedAt?.toISOString() ?? new Date().toISOString(),
      contact: member.contact
        ? {
            id: member.contact.id,
            name: member.contact.name,
            email: member.contact.email ?? undefined,
            phone: member.contact.phone ?? undefined,
            avatar: member.contact.avatarUrl ?? undefined,
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
      tenantId: auth.tenantId,
      isActive: true,
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
      orderBy: { createdAt: 'desc' },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
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
        tenantId: auth.tenantId,
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
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
        tenantId: auth.tenantId,
        name: payload.name.trim(),
        description: payload.description ?? null,
        type: payload.type ?? 'manual',
        filterCriteria: payload.filterCriteria ?? {},
        createdBy: auth.userId ?? null,
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
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
        tenantId: auth.tenantId,
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
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
        filterCriteria: payload.filterCriteria ?? list.filterCriteria,
        updatedAt: new Date(),
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
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
      where: { id: req.params.id, tenantId: auth.tenantId },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    await prisma.contact_list_members.deleteMany({ where: { listId: list.id } });
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
      where: { id: req.params.id, tenantId: auth.tenantId },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const contacts = await prisma.contacts.findMany({
      where: {
        tenantId: auth.tenantId,
        id: { in: payload.contactIds },
      },
      select: { id: true },
    });

    if (contacts.length === 0) {
      return res.status(404).json({ error: 'Contatos não encontrados' });
    }

    const existingMembers = await prisma.contact_list_members.findMany({
      where: {
        listId: list.id,
        contactId: { in: contacts.map((contact) => contact.id) },
      },
      select: { contactId: true },
    });

    const existingIds = new Set(existingMembers.map((member) => member.contactId));

    const toInsert = contacts
      .filter((contact) => !existingIds.has(contact.id))
      .map((contact) => ({
        listId: list.id,
        contactId: contact.id,
      }));

    if (toInsert.length > 0) {
      await prisma.contact_list_members.createMany({ data: toInsert });
    }

    const updatedCount = await prisma.contact_list_members.count({ where: { listId: list.id } });

    await prisma.contact_lists.update({
      where: { id: list.id },
      data: {
        contactCount: updatedCount,
        updatedAt: new Date(),
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
      where: { id, tenantId: auth.tenantId },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    await prisma.contact_list_members.deleteMany({
      where: {
        listId: list.id,
        OR: [
          { id: memberId },
          { contactId: memberId },
        ],
      },
    });

    const updatedCount = await prisma.contact_list_members.count({ where: { listId: list.id } });
    await prisma.contact_lists.update({
      where: { id: list.id },
      data: { contactCount: updatedCount, updatedAt: new Date() },
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
      where: { id: req.params.id, tenantId: auth.tenantId },
      include: { members: true },
    });

    if (!list) {
      return res.status(404).json({ error: 'Lista não encontrada' });
    }

    const duplicated = await prisma.contact_lists.create({
      data: {
        tenantId: auth.tenantId,
        name: `${list.name} (cópia)`,
        description: list.description,
        type: list.type,
        filterCriteria: list.filterCriteria,
        contactCount: list.contactCount,
        createdBy: auth.userId ?? list.createdBy,
        members: {
          create: list.members.map((member) => ({
            contactId: member.contactId,
          })),
        },
      },
      include: {
        members: {
          include: {
            contact: {
              select: { id: true, name: true, email: true, phone: true, avatarUrl: true },
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
