import { Request, Response } from 'express';
import { z } from 'zod';
import type { JWTPayload } from '@primeflow/shared/types/index.js';
import { leadsService } from '../services/leads.service.js';
import { logger } from '../lib/logger.js';

type AuthenticatedRequest = Request & { user?: JWTPayload };

const filtersSchema = z.object({
  status: z.string().optional(),
  origin: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  search: z.string().optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      return Array.isArray(value) ? value : value.split(',').map((item) => item.trim()).filter(Boolean);
    }),
  dateFrom: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
  dateTo: z
    .string()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined)),
});

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  origin: z.string().optional(),
  status: z.string().optional(),
  ownerId: z.string().uuid().optional(),
  tags: z.array(z.string()).optional(),
  customFields: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updateSchema = createSchema.partial();

const ensureAuthenticated = (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }

  return req.user;
};

export const leadsController = {
  async list(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const filters = filtersSchema.parse(req.query);
      const result = await leadsService.list({
        tenantId: auth.tenantId,
        ...filters,
      });
      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Error listing leads');
      res.status(500).json({ error: 'Erro ao listar leads' });
    }
  },

  async getById(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const lead = await leadsService.getById(req.params.id, auth.tenantId);
      if (!lead) {
        res.status(404).json({ error: 'Lead não encontrado' });
        return;
      }
      res.json(lead);
    } catch (error) {
      logger.error({ error }, 'Error fetching lead');
      res.status(500).json({ error: 'Erro ao buscar lead' });
    }
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const payload = createSchema.parse(req.body);
      const lead = await leadsService.create({
        ...payload,
        tenantId: auth.tenantId,
        ownerId: payload.ownerId ?? auth.userId ?? null,
      });

      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: error.errors });
        return;
      }

      logger.error({ error }, 'Error creating lead');
      res.status(500).json({ error: 'Erro ao criar lead' });
    }
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const payload = updateSchema.parse(req.body);
      const lead = await leadsService.update(req.params.id, auth.tenantId, payload);
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Dados inválidos', details: error.errors });
        return;
      }

      logger.error({ error }, 'Error updating lead');
      res.status(500).json({ error: 'Erro ao atualizar lead' });
    }
  },

  async remove(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      await leadsService.remove(req.params.id, auth.tenantId);
      res.status(204).send();
    } catch (error) {
      logger.error({ error }, 'Error deleting lead');
      res.status(500).json({ error: 'Erro ao remover lead' });
    }
  },

  async messages(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const messages = await leadsService.listMessages(req.params.id, auth.tenantId);
      res.json({ data: messages });
    } catch (error) {
      logger.error({ error }, 'Error fetching lead messages');
      res.status(500).json({ error: 'Erro ao listar mensagens do lead' });
    }
  },

  async distribute(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const assigneeIds = Array.isArray(req.body.assigneeIds)
        ? (req.body.assigneeIds as string[])
        : undefined;
      const result = await leadsService.distribute(auth.tenantId, assigneeIds);
      res.json(result);
    } catch (error) {
      logger.error({ error }, 'Error distributing leads');
      res.status(500).json({ error: 'Erro ao distribuir leads' });
    }
  },

  async export(req: AuthenticatedRequest, res: Response) {
    const auth = ensureAuthenticated(req, res);
    if (!auth) return;

    try {
      const filters = filtersSchema.parse(req.query);
      const { headers, rows } = await leadsService.export({
        tenantId: auth.tenantId,
        ...filters,
      });

      const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
      res.send(csv);
    } catch (error) {
      logger.error({ error }, 'Error exporting leads');
      res.status(500).json({ error: 'Erro ao exportar leads' });
    }
  },
};
