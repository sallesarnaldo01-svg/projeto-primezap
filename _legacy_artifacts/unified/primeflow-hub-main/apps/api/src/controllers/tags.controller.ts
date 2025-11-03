import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { JWTPayload } from '@primeflow/shared/types/index.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

type AuthenticatedRequest = Request & { user?: JWTPayload };

type TagWithRelations = Prisma.tagsGetPayload<{
  include: {
    category_ref: true;
  };
}>;

type CategoryWithTags = Prisma.tag_categoriesGetPayload<{
  include: {
    tags: true;
  };
}>;

const listQuerySchema = z.object({
  search: z.string().optional(),
  category: z.string().optional(),
  isGlobal: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  sortBy: z.enum(['name', 'usage', 'created']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z
    .string()
    .optional()
    .transform((value) => (value ? Math.max(parseInt(value, 10) || 1, 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Math.min(Math.max(parseInt(value, 10) || 20, 1), 100) : 20)),
});

const createTagSchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional(),
});

const updateTagSchema = createTagSchema.partial();

const mergeTagSchema = z.object({
  sourceTagIds: z.array(z.string().uuid()).min(1),
  targetTagId: z.string().uuid(),
});

const bulkOperationSchema = z.object({
  entityType: z.enum(['contact', 'deal', 'ticket', 'conversation']),
  entityIds: z.array(z.string().uuid()).min(1),
  tagIds: z.array(z.string().uuid()).min(1),
  operation: z.enum(['add', 'remove', 'replace']),
});

const categorySchema = z.object({
  name: z.string().min(1),
  color: z.string().optional(),
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

function mapTag(tag: TagWithRelations) {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color ?? '#3b82f6',
    description: tag.description ?? undefined,
    categoryId: tag.category_id ?? undefined,
    category: tag.category ?? tag.category_ref?.name ?? undefined,
    isGlobal: true,
    isActive: tag.is_active ?? true,
    workspaceId: tag.tenant_id,
    usageCount: tag.usage_count ?? 0,
    createdAt: tag.created_at?.toISOString() ?? new Date().toISOString(),
    updatedAt: tag.updated_at?.toISOString() ?? new Date().toISOString(),
    createdBy: tag.tenant_id,
  };
}

async function recalculateUsageCounts(tagIds: string[], tenantId: string) {
  if (tagIds.length === 0) {
    return;
  }

  const tags = await prisma.tags.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: tagIds },
    },
  });

  for (const tag of tags) {
    const [contactsCount, dealsCount] = await Promise.all([
      prisma.contacts.count({
        where: {
          tenant_id: tenantId,
          tags: { has: tag.name },
        },
      }),
      prisma.deal_tags.count({
        where: {
          tag_id: tag.id,
        },
      }),
    ]);

    await prisma.tags.update({
      where: { id: tag.id },
      data: {
        usage_count: contactsCount + dealsCount,
        updated_at: new Date(),
      },
    });
  }
}

async function updateContactTags(
  tenantId: string,
  entityIds: string[],
  tagNames: string[],
  operation: 'add' | 'remove' | 'replace',
) {
  const contacts = await prisma.contacts.findMany({
    where: {
      tenant_id: tenantId,
      id: { in: entityIds },
    },
    select: { id: true, tags: true },
  });

  for (const contact of contacts) {
    const currentTags = contact.tags ?? [];
    let nextTags: string[];

    switch (operation) {
      case 'add':
        nextTags = Array.from(new Set([...currentTags, ...tagNames]));
        break;
      case 'remove':
        nextTags = currentTags.filter((tag) => !tagNames.includes(tag));
        break;
      case 'replace':
        nextTags = Array.from(new Set(tagNames));
        break;
      default:
        nextTags = currentTags;
    }

    await prisma.contacts.update({
      where: { id: contact.id },
      data: {
        tags: nextTags,
        updated_at: new Date(),
      },
    });
  }
}

export async function listTags(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { search, category, isGlobal, sortBy, sortOrder, page, limit } = listQuerySchema.parse(req.query);

    const where: Prisma.tagsWhereInput = {
      tenant_id: auth.tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.OR = [
        ...(where.OR ?? []),
        { category: { equals: category, mode: 'insensitive' } },
        { category_ref: { name: { equals: category, mode: 'insensitive' } } },
      ];
    }

    if (typeof isGlobal === 'boolean' && !isGlobal) {
      // Atualmente todos os tags são globais; manter campo para compatibilidade futura.
      where.is_active = true;
    }

    const total = await prisma.tags.count({ where });

    const orderBy: Prisma.tagsOrderByWithRelationInput = (() => {
      switch (sortBy) {
        case 'usage':
          return { usage_count: sortOrder ?? 'desc' };
        case 'created':
          return { created_at: sortOrder ?? 'desc' };
        case 'name':
        default:
          return { name: sortOrder ?? 'asc' };
      }
    })();

    const tags = await prisma.tags.findMany({
      where,
      include: {
        category_ref: true,
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    const response: PaginatedResponse<ReturnType<typeof mapTag>> = {
      data: tags.map(mapTag),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };

    res.json(response);
  } catch (error) {
    logger.error({ error }, 'Error listing tags');
    res.status(500).json({ error: 'Erro ao listar tags' });
  }
}

export async function getTag(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const tag = await prisma.tags.findFirst({
      where: {
        id: req.params.id,
        tenant_id: auth.tenantId,
      },
      include: { category_ref: true },
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    res.json(mapTag(tag));
  } catch (error) {
    logger.error({ error }, 'Error fetching tag');
    res.status(500).json({ error: 'Erro ao buscar tag' });
  }
}

export async function createTag(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = createTagSchema.parse(req.body);

    let categoryData: { category_id?: string; category?: string } = {};

    if (payload.categoryId) {
      const category = await prisma.tag_categories.findFirst({
        where: { id: payload.categoryId, tenant_id: auth.tenantId },
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      categoryData = {
        category_id: category.id,
        category: category.name,
      };
    } else if (payload.category) {
      categoryData = { category: payload.category };
    }

    const tag = await prisma.tags.create({
      data: {
        tenant_id: auth.tenantId,
        name: payload.name.trim(),
        color: payload.color ?? '#3b82f6',
        description: payload.description ?? null,
        is_active: payload.isActive ?? true,
        ...categoryData,
      },
      include: { category_ref: true },
    });

    res.status(201).json(mapTag(tag));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error creating tag');
    res.status(500).json({ error: 'Erro ao criar tag' });
  }
}

export async function updateTag(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = updateTagSchema.parse(req.body);
    const tag = await prisma.tags.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
      include: { category_ref: true },
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    const data: Prisma.tagsUpdateInput = {
      updated_at: new Date(),
    };

    if (payload.name && payload.name !== tag.name) {
      data.name = payload.name.trim();

      const contacts = await prisma.contacts.findMany({
        where: {
          tenant_id: auth.tenantId,
          tags: { has: tag.name },
        },
        select: { id: true, tags: true },
      });

      for (const contact of contacts) {
        const nextTags = (contact.tags ?? []).map((item) => (item === tag.name ? payload.name!.trim() : item));
        await prisma.contacts.update({
          where: { id: contact.id },
          data: { tags: nextTags, updated_at: new Date() },
        });
      }
    }

    if (payload.color) data.color = payload.color;
    if (payload.description !== undefined) data.description = payload.description ?? null;
    if (payload.isActive !== undefined) data.is_active = payload.isActive;

    if (payload.categoryId) {
      const category = await prisma.tag_categories.findFirst({
        where: { id: payload.categoryId, tenant_id: auth.tenantId },
      });

      if (!category) {
        return res.status(404).json({ error: 'Categoria não encontrada' });
      }

      data.category_id = category.id;
      data.category = category.name;
    } else if (payload.category !== undefined) {
      data.category_id = null;
      data.category = payload.category;
    }

    const updated = await prisma.tags.update({
      where: { id: tag.id },
      data,
      include: { category_ref: true },
    });

    await recalculateUsageCounts([updated.id], auth.tenantId);

    res.json(mapTag(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error updating tag');
    res.status(500).json({ error: 'Erro ao atualizar tag' });
  }
}

export async function deleteTag(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const tag = await prisma.tags.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
    });

    if (!tag) {
      return res.status(404).json({ error: 'Tag não encontrada' });
    }

    const contacts = await prisma.contacts.findMany({
      where: {
        tenant_id: auth.tenantId,
        tags: { has: tag.name },
      },
      select: { id: true, tags: true },
    });

    for (const contact of contacts) {
      const filteredTags = (contact.tags ?? []).filter((item) => item !== tag.name);
      await prisma.contacts.update({
        where: { id: contact.id },
        data: { tags: filteredTags, updated_at: new Date() },
      });
    }

    await prisma.deal_tags.deleteMany({ where: { tag_id: tag.id } });
    await prisma.tags.delete({ where: { id: tag.id } });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error deleting tag');
    res.status(500).json({ error: 'Erro ao deletar tag' });
  }
}

export async function mergeTags(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = mergeTagSchema.parse(req.body);

    const target = await prisma.tags.findFirst({
      where: { id: payload.targetTagId, tenant_id: auth.tenantId },
    });

    if (!target) {
      return res.status(404).json({ error: 'Tag destino não encontrada' });
    }

    const sourceTags = await prisma.tags.findMany({
      where: {
        id: { in: payload.sourceTagIds },
        tenant_id: auth.tenantId,
      },
    });

    if (sourceTags.length === 0) {
      return res.status(404).json({ error: 'Nenhuma tag de origem encontrada' });
    }

    const sourceNames = sourceTags.map((tag) => tag.name);

    const contacts = await prisma.contacts.findMany({
      where: {
        tenant_id: auth.tenantId,
        tags: { hasSome: sourceNames },
      },
      select: { id: true, tags: true },
    });

    for (const contact of contacts) {
      const nextTags = Array.from(
        new Set([
          ...(contact.tags ?? []).filter((tagName) => !sourceNames.includes(tagName)),
          target.name,
        ]),
      );

      await prisma.contacts.update({
        where: { id: contact.id },
        data: { tags: nextTags, updated_at: new Date() },
      });
    }

    await prisma.deal_tags.updateMany({
      where: { tag_id: { in: payload.sourceTagIds } },
      data: { tag_id: target.id },
    });

    await prisma.tags.deleteMany({ where: { id: { in: payload.sourceTagIds } } });
    await recalculateUsageCounts([target.id], auth.tenantId);

    res.json({ success: true, message: 'Tags mescladas com sucesso' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error merging tags');
    res.status(500).json({ error: 'Erro ao mesclar tags' });
  }
}

export async function bulkOperation(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = bulkOperationSchema.parse(req.body);

    const tags = await prisma.tags.findMany({
      where: {
        tenant_id: auth.tenantId,
        id: { in: payload.tagIds },
      },
    });

    if (tags.length === 0) {
      return res.status(404).json({ error: 'Tags não encontradas' });
    }

    const tagNames = tags.map((tag) => tag.name);

    if (payload.entityType !== 'contact') {
      return res.status(400).json({ error: 'Operação suportada apenas para contatos no momento' });
    }

    await updateContactTags(auth.tenantId, payload.entityIds, tagNames, payload.operation);
    await recalculateUsageCounts(payload.tagIds, auth.tenantId);

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error executing bulk tag operation');
    res.status(500).json({ error: 'Erro na operação em massa' });
  }
}

export async function getCategories(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const categories = await prisma.tag_categories.findMany({
      where: { tenant_id: auth.tenantId },
      include: { tags: true },
      orderBy: { name: 'asc' },
    });

    const response = categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color ?? '#4A90E2',
      tags: category.tags.map(mapTag),
    }));

    res.json(response);
  } catch (error) {
    logger.error({ error }, 'Error listing tag categories');
    res.status(500).json({ error: 'Erro ao listar categorias' });
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = categorySchema.parse(req.body);

    const category = await prisma.tag_categories.create({
      data: {
        tenant_id: auth.tenantId,
        name: payload.name.trim(),
        color: payload.color ?? '#4A90E2',
      },
    });

    res.status(201).json({ id: category.id, name: category.name, color: category.color });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error creating tag category');
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
}

export async function updateCategory(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = categorySchema.partial().parse(req.body);

    const category = await prisma.tag_categories.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const updated = await prisma.tag_categories.update({
      where: { id: category.id },
      data: {
        name: payload.name?.trim() ?? category.name,
        color: payload.color ?? category.color,
        updated_at: new Date(),
      },
    });

    if (payload.name) {
      await prisma.tags.updateMany({
        where: { category_id: category.id },
        data: { category: payload.name.trim() },
      });
    }

    res.json({ id: updated.id, name: updated.name, color: updated.color });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error updating tag category');
    res.status(500).json({ error: 'Erro ao atualizar categoria' });
  }
}

export async function deleteCategory(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const category = await prisma.tag_categories.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
    });

    if (!category) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    await prisma.tags.updateMany({
      where: { category_id: category.id },
      data: { category_id: null, category: null },
    });

    await prisma.tag_categories.delete({ where: { id: category.id } });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error deleting tag category');
    res.status(500).json({ error: 'Erro ao deletar categoria' });
  }
}

export async function getUsageStats(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const tagIds = (req.query.tagIds ? String(req.query.tagIds) : '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);

    const where: Prisma.tagsWhereInput = {
      tenant_id: auth.tenantId,
      ...(tagIds.length > 0 ? { id: { in: tagIds } } : {}),
    };

    const tags = await prisma.tags.findMany({ where });

    const stats = await Promise.all(
      tags.map(async (tag) => {
        const contacts = await prisma.contacts.count({
          where: { tenant_id: auth.tenantId, tags: { has: tag.name } },
        });

        const deals = await prisma.deal_tags.count({ where: { tag_id: tag.id } });

        return {
          tagId: tag.id,
          tagName: tag.name,
          contacts,
          companies: 0,
          deals,
          tickets: 0,
          conversations: 0,
          total: contacts + deals,
        };
      }),
    );

    res.json(stats);
  } catch (error) {
    logger.error({ error }, 'Error generating tag usage stats');
    res.status(500).json({ error: 'Erro ao buscar estatísticas de uso' });
  }
}

export async function searchTags(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const query = String(req.query.query ?? '').trim();
    const limit = Number(req.query.limit ?? 10);

    if (!query) {
      return res.json([]);
    }

    const tags = await prisma.tags.findMany({
      where: {
        tenant_id: auth.tenantId,
        name: { contains: query, mode: 'insensitive' },
      },
      take: Math.min(Math.max(limit, 1), 50),
      orderBy: { name: 'asc' },
      include: { category_ref: true },
    });

    res.json(tags.map(mapTag));
  } catch (error) {
    logger.error({ error }, 'Error searching tags');
    res.status(500).json({ error: 'Erro na busca de tags' });
  }
}

export async function getPopularTags(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const limit = Number(req.query.limit ?? 20);

    const tags = await prisma.tags.findMany({
      where: { tenant_id: auth.tenantId },
      orderBy: { usage_count: 'desc' },
      take: Math.min(Math.max(limit, 1), 50),
      include: { category_ref: true },
    });

    res.json(tags.map(mapTag));
  } catch (error) {
    logger.error({ error }, 'Error fetching popular tags');
    res.status(500).json({ error: 'Erro ao buscar tags populares' });
  }
}
