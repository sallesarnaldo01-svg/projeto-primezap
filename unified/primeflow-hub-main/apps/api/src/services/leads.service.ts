import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export interface LeadFilters {
  tenantId: string;
  status?: string;
  origin?: string;
  ownerId?: string;
  search?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CreateLeadInput {
  tenantId: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  origin?: string | null;
  status?: string | null;
  ownerId?: string | null;
  tags?: string[];
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateLeadInput {
  name?: string;
  email?: string | null;
  phone?: string | null;
  origin?: string | null;
  status?: string | null;
  ownerId?: string | null;
  tags?: string[];
  score?: number;
  customFields?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

type ContactWithMetadata = Prisma.contactsGetPayload<{
  select: {
    id: true;
    name: true;
    email: true;
    phone: true;
    lead_status: true;
    origem: true;
    user_id: true;
    tags: true;
    metadata: true;
    custom_fields: true;
    created_at: true;
    updated_at: true;
  };
}>;

type JsonRecord = Record<string, Prisma.JsonValue>;

const toJsonObject = (value: unknown): Prisma.JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};

const mapLead = (lead: ContactWithMetadata) => {
  const metadata = toJsonObject(lead.metadata);
  const customFields = toJsonObject(lead.custom_fields);

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    status: lead.lead_status ?? 'novo',
    origin: lead.origem ?? 'manual',
    ownerId: lead.user_id ?? null,
    tags: lead.tags ?? [],
    score: typeof metadata.score === 'number' ? metadata.score : null,
    customFields,
    createdAt: lead.created_at?.toISOString() ?? new Date().toISOString(),
    updatedAt: lead.updated_at?.toISOString() ?? new Date().toISOString(),
  };
};

export const leadsService = {
  async list(filters: LeadFilters) {
    const where: Prisma.contactsWhereInput = {
      tenant_id: filters.tenantId,
    };

    if (filters.status && filters.status !== 'all') {
      where.lead_status = filters.status;
    }
    if (filters.origin) {
      where.origem = filters.origin;
    }
    if (filters.ownerId) {
      where.user_id = filters.ownerId;
    }
    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { phone: { contains: term } },
      ];
    }
    if (filters.tags && filters.tags.length > 0) {
      where.tags = { hasSome: filters.tags };
    }
    if (filters.dateFrom || filters.dateTo) {
      where.created_at = {};
      if (filters.dateFrom) {
        (where.created_at as Prisma.DateTimeFilter).gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (where.created_at as Prisma.DateTimeFilter).lte = filters.dateTo;
      }
    }

    const [items, total] = await Promise.all([
      prisma.contacts.findMany({
        where,
        orderBy: { created_at: 'desc' },
      }),
      prisma.contacts.count({ where }),
    ]);

    return {
      data: items.map(mapLead),
      total,
    };
  },

  async getById(id: string, tenantId: string) {
    const lead = await prisma.contacts.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    return lead ? mapLead(lead) : null;
  },

  async create(data: CreateLeadInput) {
    const lead = await prisma.contacts.create({
      data: {
        tenant_id: data.tenantId,
        name: data.name.trim(),
        email: data.email ?? null,
        phone: data.phone ?? null,
        origem: data.origin ?? 'manual',
        lead_status: data.status ?? 'novo',
        user_id: data.ownerId ?? null,
        tags: data.tags ?? [],
        custom_fields: toJsonObject(data.customFields),
        metadata: toJsonObject(data.metadata),
      },
    });

    logger.info(
      { leadId: lead.id, tenantId: data.tenantId, origin: data.origin ?? 'manual' },
      'Lead created',
    );

    await prisma.contact_activities.create({
      data: {
        contact_id: lead.id,
        type: 'lead_created',
        description: `Lead criado com status ${lead.lead_status}`,
      },
    });

    return mapLead(lead);
  },

  async update(id: string, tenantId: string, data: UpdateLeadInput) {
    const lead = await prisma.contacts.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const updates: Prisma.contactsUpdateInput = {
      updated_at: new Date(),
    };

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.email !== undefined) updates.email = data.email ?? null;
    if (data.phone !== undefined) updates.phone = data.phone ?? null;
    if (data.origin !== undefined) updates.origem = data.origin ?? 'manual';
    if (data.status !== undefined) {
      updates.lead_status = data.status;
      if (data.status !== lead.lead_status) {
        await prisma.contact_activities.create({
          data: {
            contact_id: id,
            type: 'lead_status_change',
            description: `Status alterado de ${lead.lead_status ?? 'indefinido'} para ${data.status}`,
          },
        });
      }
    }
    if (data.ownerId !== undefined) updates.user_id = data.ownerId ?? null;
    if (data.tags) updates.tags = data.tags;
    if (data.customFields) updates.custom_fields = toJsonObject(data.customFields);

    const metadata = { ...toJsonObject(lead.metadata) } as Prisma.JsonObject;
    let metadataChanged = false;

    if (data.score !== undefined) {
      metadata.score = data.score;
      metadataChanged = true;
    }
    if (data.metadata) {
      for (const [key, value] of Object.entries(data.metadata)) {
        metadata[key] = value as Prisma.JsonValue;
      }
      metadataChanged = true;
    }

    if (metadataChanged) {
      updates.metadata = metadata;
    }

    const updated = await prisma.contacts.update({
      where: { id },
      data: updates,
    });

    return mapLead(updated);
  },

  async remove(id: string, tenantId: string) {
    await prisma.contacts.delete({
      where: {
        id,
        tenant_id: tenantId,
      },
    });

    logger.info({ leadId: id, tenantId }, 'Lead removed');
  },

  async listMessages(leadId: string, tenantId: string) {
    const lead = await prisma.contacts.findFirst({
      where: { id: leadId, tenant_id: tenantId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const messages = await prisma.messages.findMany({
      where: {
        conversations: {
          contact_id: leadId,
        },
      },
      orderBy: { created_at: 'desc' },
      take: 100,
    });

    return messages.map((message) => ({
      id: message.id,
      content: message.content ?? '',
      type: message.type ?? 'text',
      sender: message.sender,
      status: message.status ?? 'pending',
      createdAt: message.created_at?.toISOString() ?? new Date().toISOString(),
    }));
  },

  async distribute(tenantId: string, assigneeIds?: string[]) {
    const assignees =
      assigneeIds && assigneeIds.length > 0
        ? assigneeIds
        : (
            await prisma.public_users.findMany({
              where: { tenant_id: tenantId, role: 'agent', is_active: true },
              select: { id: true },
            })
          ).map((user) => user.id);

    if (assignees.length === 0) {
      return { assigned: 0 };
    }

    const leads = await prisma.contacts.findMany({
      where: {
        tenant_id: tenantId,
        user_id: null,
        lead_status: { in: ['novo', 'new', 'open'] },
      },
      orderBy: { created_at: 'asc' },
      take: 200,
    });

    if (leads.length === 0) {
      return { assigned: 0 };
    }

    const updates = leads.map((lead, index) =>
      prisma.contacts.update({
        where: { id: lead.id },
        data: {
          user_id: assignees[index % assignees.length],
          updated_at: new Date(),
        },
      }),
    );

    await prisma.$transaction(updates);

    logger.info(
      { tenantId, total: leads.length, assignees: assignees.length },
      'Leads redistributed',
    );

    return { assigned: leads.length };
  },

  async export(filters: LeadFilters) {
    const result = await this.list(filters);
    const headers = ['id', 'name', 'email', 'phone', 'origin', 'status', 'ownerId', 'createdAt'];
    const rows = result.data.map((lead) => [
      lead.id,
      lead.name,
      lead.email ?? '',
      lead.phone ?? '',
      lead.origin,
      lead.status,
      lead.ownerId ?? '',
      lead.createdAt,
    ]);

    return { headers, rows };
  },
};
