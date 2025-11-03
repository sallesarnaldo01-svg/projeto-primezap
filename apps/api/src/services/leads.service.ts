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
    leadStatus: true;
    origin: true;
    userId: true;
    tags: true;
    metadata: true;
    customFields: true;
    createdAt: true;
    updatedAt: true;
    saleProbability: true;
    ultimoContato: true;
    totalInteracoes: true;
  };
}>;

type JsonRecord = Record<string, Prisma.JsonValue>;

const toJsonObject = (value: unknown): Prisma.JsonObject =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as JsonRecord) }
    : {};

const mapLead = (lead: ContactWithMetadata) => {
  const metadata = toJsonObject(lead.metadata);
  const customFields = toJsonObject(lead.customFields);

  return {
    id: lead.id,
    name: lead.name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    status: lead.leadStatus ?? 'novo',
    origin: lead.origin ?? 'manual',
    ownerId: lead.userId ?? null,
    tags: lead.tags ?? [],
    score: typeof metadata.score === 'number' ? metadata.score : null,
    saleProbability: typeof lead.saleProbability === 'number' ? lead.saleProbability : null,
    ultimoContato: lead.ultimoContato?.toISOString() ?? null,
    totalInteracoes: typeof lead.totalInteracoes === 'number' ? lead.totalInteracoes : 0,
    customFields,
    createdAt: lead.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: lead.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
};

export const leadsService = {
  async list(filters: LeadFilters) {
    const where: Prisma.contactsWhereInput = {
      tenantId: filters.tenantId,
    };

    if (filters.status && filters.status !== 'all') {
      where.leadStatus = filters.status;
    }
    if (filters.origin) {
      where.origin = filters.origin;
    }
    if (filters.ownerId) {
      where.userId = filters.ownerId;
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
      where.createdAt = {};
      if (filters.dateFrom) {
        (where.createdAt as Prisma.DateTimeFilter).gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        (where.createdAt as Prisma.DateTimeFilter).lte = filters.dateTo;
      }
    }

    const [items, total] = await Promise.all([
      prisma.contacts.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
        tenantId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        leadStatus: true,
        origin: true,
        userId: true,
        tags: true,
        metadata: true,
        customFields: true,
        createdAt: true,
        updatedAt: true,
        saleProbability: true,
        ultimoContato: true,
        totalInteracoes: true,
      },
    });

    return lead ? mapLead(lead) : null;
  },

  async create(data: CreateLeadInput) {
    const lead = await prisma.contacts.create({
      data: {
        tenantId: data.tenantId,
        name: data.name.trim(),
        email: data.email ?? null,
        phone: data.phone ?? null,
        origin: data.origin ?? 'manual',
        leadStatus: data.status ?? 'novo',
        userId: data.ownerId ?? null,
        tags: data.tags ?? [],
        customFields: toJsonObject(data.customFields),
        metadata: toJsonObject(data.metadata),
      },
    });

    logger.info(
      { leadId: lead.id, tenantId: data.tenantId, origin: data.origin ?? 'manual' },
      'Lead created',
    );

    await prisma.contact_activities.create({
      data: {
        contactId: lead.id,
        type: 'lead_created',
        description: `Lead criado com status ${lead.leadStatus}`,
      },
    });

    return mapLead(lead);
  },

  async update(id: string, tenantId: string, data: UpdateLeadInput) {
    const lead = await prisma.contacts.findFirst({
      where: { id, tenantId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const updates: Prisma.contactsUpdateInput = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updates.name = data.name.trim();
    if (data.email !== undefined) updates.email = data.email ?? null;
    if (data.phone !== undefined) updates.phone = data.phone ?? null;
    if (data.origin !== undefined) updates.origin = data.origin ?? 'manual';
    if (data.status !== undefined) {
      updates.leadStatus = data.status;
      if (data.status !== lead.leadStatus) {
        await prisma.contact_activities.create({
          data: {
            contactId: id,
            type: 'lead_status_change',
            description: `Status alterado de ${lead.leadStatus ?? 'indefinido'} para ${data.status}`,
          },
        });
      }
    }
    if (data.ownerId !== undefined) updates.userId = data.ownerId ?? null;
    if (data.tags) updates.tags = data.tags;
    if (data.customFields) updates.customFields = toJsonObject(data.customFields);

    // Allow probability 1-5 update
    if ((data as any).saleProbability !== undefined) {
      const p = Number((data as any).saleProbability);
      if (!Number.isNaN(p) && p >= 1 && p <= 5) {
        (updates as any).saleProbability = p;
        await prisma.contact_activities.create({
          data: {
            contactId: id,
            type: 'lead_probability_change',
            description: `Probabilidade alterada para ${p}`,
          },
        });
      }
    }

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
        tenantId,
      },
    });

    logger.info({ leadId: id, tenantId }, 'Lead removed');
  },

  async listMessages(leadId: string, tenantId: string) {
    const lead = await prisma.contacts.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!lead) {
      throw new Error('Lead not found');
    }

    const messages = await prisma.message.findMany({
      where: {
        conversation: {
          contactId: leadId,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return messages.map((message) => ({
      id: message.id,
      content: message.content ?? '',
      type: message.type ?? 'text',
      sender: message.sender,
      status: message.status ?? 'pending',
      createdAt: message.createdAt?.toISOString() ?? new Date().toISOString(),
    }));
  },

  async distribute(tenantId: string, assigneeIds?: string[]) {
    const assignees =
      assigneeIds && assigneeIds.length > 0
        ? assigneeIds
        : (
            await prisma.public_users.findMany({
              where: { tenantId, role: 'agent', isActive: true },
              select: { id: true },
            })
          ).map((user) => user.id);

    if (assignees.length === 0) {
      return { assigned: 0 };
    }

    const leads = await prisma.contacts.findMany({
      where: {
        tenantId,
        userId: null,
        leadStatus: { in: ['novo', 'new', 'open'] },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    if (leads.length === 0) {
      return { assigned: 0 };
    }

    const updates = leads.map((lead, index) =>
      prisma.contacts.update({
        where: { id: lead.id },
        data: {
          userId: assignees[index % assignees.length],
          updatedAt: new Date(),
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
