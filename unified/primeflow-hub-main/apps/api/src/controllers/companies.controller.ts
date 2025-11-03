import { Request, Response } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import type { JWTPayload } from '@primeflow/shared/types/index.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

type AuthenticatedRequest = Request & { user?: JWTPayload };

type CompanyWithRelations = Prisma.companiesGetPayload<{
  include: {
    owner: {
      select: {
        id: true;
        name: true;
        email: true;
        avatar: true;
      };
    };
    contacts: {
      select: {
        id: true;
        name: true;
        email: true;
        phone: true;
        avatar_url: true;
      };
    };
  };
}>;

const listSchema = z.object({
  search: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  status: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  page: z
    .string()
    .optional()
    .transform((value) => (value ? Math.max(parseInt(value, 10) || 1, 1) : 1)),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Math.min(Math.max(parseInt(value, 10) || 20, 1), 100) : 20)),
});

const addressSchema = z.object({
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
});

const createCompanySchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  industry: z.string().optional(),
  size: z.string().optional(),
  website: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: addressSchema.optional(),
  logoUrl: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.string().optional(),
  healthScore: z.number().min(0).max(100).optional(),
  revenue: z.number().optional(),
  employees: z.number().int().optional(),
  ownerId: z.string().uuid().optional(),
  customFields: z.record(z.any()).optional(),
});

const updateCompanySchema = createCompanySchema.partial();

const addContactSchema = z.object({
  contactId: z.string().uuid(),
  isPrimary: z.boolean().optional(),
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

function serializeAddress(address: Record<string, unknown> | null | undefined) {
  if (!address) {
    return undefined;
  }

  const {
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    zipCode,
    country,
  } = address as Record<string, string | undefined>;

  return {
    street,
    number,
    complement,
    neighborhood,
    city,
    state,
    zipCode,
    country,
  };
}

function mapCompany(company: CompanyWithRelations) {
  return {
    id: company.id,
    name: company.name,
    legalName: company.legal_name ?? undefined,
    taxId: company.tax_id ?? undefined,
    industry: company.industry ?? undefined,
    size: company.size ?? undefined,
    website: company.website ?? undefined,
    email: company.email ?? undefined,
    phone: company.phone ?? undefined,
    address: serializeAddress(company.address as Record<string, unknown> | undefined),
    logoUrl: company.logo_url ?? undefined,
    description: company.description ?? undefined,
    tags: company.tags ?? [],
    status: (company.status ?? 'active') as
      | 'active'
      | 'inactive'
      | 'prospect'
      | 'customer'
      | 'churned',
    healthScore: company.health_score ?? 0,
    revenue: company.revenue ? Number(company.revenue) : undefined,
    employees: company.employees ?? undefined,
    ownerId: company.owner_id ?? undefined,
    owner: company.owner
      ? {
          id: company.owner.id,
          name: company.owner.name,
          email: company.owner.email,
          avatar: company.owner.avatar ?? undefined,
        }
      : undefined,
    lastInteraction: company.last_interaction_at?.toISOString(),
    customFields: (company.custom_fields as Record<string, unknown> | undefined) ?? {},
    createdAt: company.created_at?.toISOString() ?? new Date().toISOString(),
    updatedAt: company.updated_at?.toISOString() ?? new Date().toISOString(),
    contacts: company.contacts.map((contact) => ({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      avatar: contact.avatar_url ?? undefined,
    })),
  };
}

export async function listCompanies(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { search, industry, size, status, ownerId, page, limit } = listSchema.parse(req.query);

    const where: Prisma.companiesWhereInput = {
      tenant_id: auth.tenantId,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { legal_name: { contains: search, mode: 'insensitive' } },
        { tax_id: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (industry) where.industry = { equals: industry, mode: 'insensitive' };
    if (size) where.size = { equals: size, mode: 'insensitive' };
    if (status) where.status = { equals: status, mode: 'insensitive' };
    if (ownerId) where.owner_id = ownerId;

    const total = await prisma.companies.count({ where });
    const companies = await prisma.companies.findMany({
      where,
      orderBy: { updated_at: 'desc' },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        contacts: {
          select: { id: true, name: true, email: true, phone: true, avatar_url: true },
          take: 5,
        },
      },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      data: companies.map(mapCompany),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Error listing companies');
    res.status(500).json({ error: 'Erro ao listar empresas' });
  }
}

export async function getCompany(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const company = await prisma.companies.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        contacts: {
          select: { id: true, name: true, email: true, phone: true, avatar_url: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json(mapCompany(company));
  } catch (error) {
    logger.error({ error }, 'Error fetching company');
    res.status(500).json({ error: 'Erro ao buscar empresa' });
  }
}

export async function createCompany(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = createCompanySchema.parse(req.body);

    const ownerData: { owner_id?: string } = {};
    if (payload.ownerId) {
      const owner = await prisma.public_users.findFirst({
        where: { id: payload.ownerId, tenant_id: auth.tenantId },
      });

      if (!owner) {
        return res.status(404).json({ error: 'Responsável não encontrado' });
      }

      ownerData.owner_id = owner.id;
    }

    const company = await prisma.companies.create({
      data: {
        tenant_id: auth.tenantId,
        name: payload.name.trim(),
        legal_name: payload.legalName ?? null,
        tax_id: payload.taxId ?? null,
        industry: payload.industry ?? null,
        size: payload.size ?? null,
        website: payload.website ?? null,
        email: payload.email ?? null,
        phone: payload.phone ?? null,
        address: payload.address ?? {},
        logo_url: payload.logoUrl ?? null,
        description: payload.description ?? null,
        tags: payload.tags ?? [],
        status: payload.status ?? 'active',
        health_score: payload.healthScore ?? 0,
        revenue: payload.revenue ?? null,
        employees: payload.employees ?? null,
        custom_fields: payload.customFields ?? {},
        last_interaction_at: null,
        ...ownerData,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        contacts: {
          select: { id: true, name: true, email: true, phone: true, avatar_url: true },
        },
      },
    });

    res.status(201).json(mapCompany(company));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error creating company');
    res.status(500).json({ error: 'Erro ao criar empresa' });
  }
}

export async function updateCompany(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = updateCompanySchema.parse(req.body);

    const company = await prisma.companies.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        contacts: {
          select: { id: true, name: true, email: true, phone: true, avatar_url: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const ownerData: { owner_id?: string | null } = {};
    if (payload.ownerId !== undefined) {
      if (payload.ownerId === null) {
        ownerData.owner_id = null;
      } else {
        const owner = await prisma.public_users.findFirst({
          where: { id: payload.ownerId, tenant_id: auth.tenantId },
        });

        if (!owner) {
          return res.status(404).json({ error: 'Responsável não encontrado' });
        }

        ownerData.owner_id = owner.id;
      }
    }

    const updated = await prisma.companies.update({
      where: { id: company.id },
      data: {
        name: payload.name?.trim() ?? company.name,
        legal_name: payload.legalName ?? company.legal_name,
        tax_id: payload.taxId ?? company.tax_id,
        industry: payload.industry ?? company.industry,
        size: payload.size ?? company.size,
        website: payload.website ?? company.website,
        email: payload.email ?? company.email,
        phone: payload.phone ?? company.phone,
        address: payload.address ?? company.address,
        logo_url: payload.logoUrl ?? company.logo_url,
        description: payload.description ?? company.description,
        tags: payload.tags ?? company.tags,
        status: payload.status ?? company.status,
        health_score: payload.healthScore ?? company.health_score,
        revenue: payload.revenue ?? company.revenue,
        employees: payload.employees ?? company.employees,
        custom_fields: payload.customFields ?? company.custom_fields,
        updated_at: new Date(),
        ...ownerData,
      },
      include: {
        owner: { select: { id: true, name: true, email: true, avatar: true } },
        contacts: {
          select: { id: true, name: true, email: true, phone: true, avatar_url: true },
        },
      },
    });

    res.json(mapCompany(updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error updating company');
    res.status(500).json({ error: 'Erro ao atualizar empresa' });
  }
}

export async function deleteCompany(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const company = await prisma.companies.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
      include: { contacts: { select: { id: true } } },
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    if (company.contacts.length > 0) {
      await prisma.contacts.updateMany({
        where: { id: { in: company.contacts.map((contact) => contact.id) } },
        data: { company_id: null },
      });
    }

    await prisma.companies.delete({ where: { id: company.id } });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error deleting company');
    res.status(500).json({ error: 'Erro ao deletar empresa' });
  }
}

export async function getCompanyContacts(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const company = await prisma.companies.findFirst({
      where: { id: req.params.id, tenant_id: auth.tenantId },
      select: {
        contacts: {
          select: { id: true, name: true, email: true, phone: true, avatar_url: true },
        },
      },
    });

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    res.json(
      company.contacts.map((contact) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email ?? undefined,
        phone: contact.phone ?? undefined,
        avatar: contact.avatar_url ?? undefined,
      })),
    );
  } catch (error) {
    logger.error({ error }, 'Error fetching company contacts');
    res.status(500).json({ error: 'Erro ao listar contatos da empresa' });
  }
}

export async function addCompanyContact(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const payload = addContactSchema.parse(req.body);

    const [company, contact] = await Promise.all([
      prisma.companies.findFirst({ where: { id: req.params.id, tenant_id: auth.tenantId } }),
      prisma.contacts.findFirst({
        where: { id: payload.contactId, tenant_id: auth.tenantId },
        select: { id: true, name: true, email: true, phone: true, avatar_url: true },
      }),
    ]);

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    if (!contact) {
      return res.status(404).json({ error: 'Contato não encontrado' });
    }

    await prisma.contacts.update({
      where: { id: contact.id },
      data: { company_id: company.id },
    });

    res.status(201).json({
      id: contact.id,
      name: contact.name,
      email: contact.email ?? undefined,
      phone: contact.phone ?? undefined,
      avatar: contact.avatar_url ?? undefined,
      isPrimary: payload.isPrimary ?? false,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }

    logger.error({ error }, 'Error attaching contact to company');
    res.status(500).json({ error: 'Erro ao vincular contato' });
  }
}

export async function removeCompanyContact(req: AuthenticatedRequest, res: Response) {
  const auth = ensureAuthenticated(req, res);
  if (!auth) return;

  try {
    const { id, contactId } = req.params as { id: string; contactId: string };

    const company = await prisma.companies.findFirst({ where: { id, tenant_id: auth.tenantId } });

    if (!company) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    await prisma.contacts.updateMany({
      where: { id: contactId, company_id: company.id },
      data: { company_id: null },
    });

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Error removing contact from company');
    res.status(500).json({ error: 'Erro ao remover contato da empresa' });
  }
}
