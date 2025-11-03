/**
 * Deals Controller - Backend API
 * Primeflow-Hub - Patch 2
 * 
 * Controller para gerenciamento de deals (negócios/oportunidades)
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';

// Schema de validação
const dealSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  value: z.number().min(0, 'Valor deve ser positivo').optional(),
  stage: z.enum([
    'lead',
    'contato',
    'qualificacao',
    'proposta',
    'negociacao',
    'ganho',
    'perdido',
  ]).optional(),
  contactId: z.string().uuid('ID de contato inválido'),
  userId: z.string().uuid('ID de usuário inválido').optional(),
  expectedCloseDate: z.string().optional(),
  probability: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const dealsController = {
  /**
   * GET /api/deals
   * Listar todos os deals com filtros
   */
  async listDeals(req: Request, res: Response) {
    try {
      const { tenantId } = req.user;
      const { stage, userId, contactId, minValue, maxValue } = req.query;

      let where: any = { tenantId };

      if (stage) {
        where.stage = stage;
      }

      if (userId) {
        where.userId = userId;
      }

      if (contactId) {
        where.contactId = contactId;
      }

      if (minValue) {
        where.value = { ...where.value, gte: parseFloat(minValue as string) };
      }

      if (maxValue) {
        where.value = { ...where.value, lte: parseFloat(maxValue as string) };
      }

      const deals = await prisma.deal.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(deals);
    } catch (error) {
      console.error('Error listing deals:', error);
      res.status(500).json({ 
        error: 'Erro ao listar deals',
        message: error.message 
      });
    }
  },

  /**
   * GET /api/deals/by-stage
   * Listar deals agrupados por estágio (para Kanban)
   */
  async getDealsByStage(req: Request, res: Response) {
    try {
      const { tenantId } = req.user;

      const stages = [
        'lead',
        'contato',
        'qualificacao',
        'proposta',
        'negociacao',
        'ganho',
        'perdido',
      ];

      const dealsByStage: Record<string, any[]> = {};

      for (const stage of stages) {
        const deals = await prisma.deal.findMany({
          where: { tenantId, stage },
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                phone: true,
              },
            },
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        dealsByStage[stage] = deals;
      }

      res.json(dealsByStage);
    } catch (error) {
      console.error('Error getting deals by stage:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar deals por estágio',
        message: error.message 
      });
    }
  },

  /**
   * GET /api/deals/:id
   * Buscar deal por ID
   */
  async getDeal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId } = req.user;

      const deal = await prisma.deal.findFirst({
        where: { id, tenantId },
        include: {
          contact: true,
          user: true,
        },
      });

      if (!deal) {
        return res.status(404).json({ error: 'Deal não encontrado' });
      }

      res.json(deal);
    } catch (error) {
      console.error('Error getting deal:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar deal',
        message: error.message 
      });
    }
  },

  /**
   * POST /api/deals
   * Criar novo deal
   */
  async createDeal(req: Request, res: Response) {
    try {
      const { tenantId, userId } = req.user;
      
      // Validar dados
      const validatedData = dealSchema.parse(req.body);

      // Verificar se contato existe
      const contact = await prisma.contact.findFirst({
        where: { 
          id: validatedData.contactId,
          tenantId,
        },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      const deal = await prisma.deal.create({
        data: {
          tenantId,
          title: validatedData.title,
          value: validatedData.value || 0,
          stage: validatedData.stage || 'lead',
          contactId: validatedData.contactId,
          userId: validatedData.userId || userId,
          expectedCloseDate: validatedData.expectedCloseDate 
            ? new Date(validatedData.expectedCloseDate)
            : null,
          probability: validatedData.probability || 10,
          notes: validatedData.notes,
        },
        include: {
          contact: true,
          user: true,
        },
      });

      // Registrar atividade
      await prisma.contactActivity.create({
        data: {
          contactId: validatedData.contactId,
          userId,
          type: 'deal_created',
          description: `Deal "${validatedData.title}" criado`,
        },
      });

      res.status(201).json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: error.errors 
        });
      }

      console.error('Error creating deal:', error);
      res.status(500).json({ 
        error: 'Erro ao criar deal',
        message: error.message 
      });
    }
  },

  /**
   * PUT /api/deals/:id
   * Atualizar deal
   */
  async updateDeal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId, userId } = req.user;

      // Verificar se deal existe
      const existing = await prisma.deal.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Deal não encontrado' });
      }

      // Validar dados (parcial)
      const validatedData = dealSchema.partial().parse(req.body);

      const deal = await prisma.deal.update({
        where: { id },
        data: {
          ...validatedData,
          expectedCloseDate: validatedData.expectedCloseDate 
            ? new Date(validatedData.expectedCloseDate)
            : undefined,
          updatedAt: new Date(),
        },
        include: {
          contact: true,
          user: true,
        },
      });

      // Registrar mudança de estágio
      if (validatedData.stage && validatedData.stage !== existing.stage) {
        await prisma.dealHistory.create({
          data: {
            dealId: id,
            userId,
            action: 'stage_changed',
            oldValue: existing.stage,
            newValue: validatedData.stage,
          },
        });

        await prisma.contactActivity.create({
          data: {
            contactId: deal.contactId,
            userId,
            type: 'deal_stage_changed',
            description: `Deal movido de "${existing.stage}" para "${validatedData.stage}"`,
          },
        });
      }

      res.json(deal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: error.errors 
        });
      }

      console.error('Error updating deal:', error);
      res.status(500).json({ 
        error: 'Erro ao atualizar deal',
        message: error.message 
      });
    }
  },

  /**
   * PATCH /api/deals/:id/stage
   * Atualizar apenas o estágio do deal (para drag-and-drop)
   */
  async updateStage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { stage } = req.body;
      const { tenantId, userId } = req.user;

      if (!stage) {
        return res.status(400).json({ error: 'Estágio não fornecido' });
      }

      const existing = await prisma.deal.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Deal não encontrado' });
      }

      // Atualizar probabilidade baseado no estágio
      const probabilityMap: Record<string, number> = {
        lead: 10,
        contato: 20,
        qualificacao: 40,
        proposta: 60,
        negociacao: 80,
        ganho: 100,
        perdido: 0,
      };

      const deal = await prisma.deal.update({
        where: { id },
        data: {
          stage,
          probability: probabilityMap[stage] || 0,
          updatedAt: new Date(),
        },
        include: {
          contact: true,
          user: true,
        },
      });

      // Registrar histórico
      await prisma.dealHistory.create({
        data: {
          dealId: id,
          userId,
          action: 'stage_changed',
          oldValue: existing.stage,
          newValue: stage,
        },
      });

      res.json(deal);
    } catch (error) {
      console.error('Error updating stage:', error);
      res.status(500).json({ 
        error: 'Erro ao atualizar estágio',
        message: error.message 
      });
    }
  },

  /**
   * DELETE /api/deals/:id
   * Deletar deal
   */
  async deleteDeal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId } = req.user;

      const existing = await prisma.deal.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Deal não encontrado' });
      }

      await prisma.deal.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Deal deletado com sucesso' });
    } catch (error) {
      console.error('Error deleting deal:', error);
      res.status(500).json({ 
        error: 'Erro ao deletar deal',
        message: error.message 
      });
    }
  },

  /**
   * POST /api/deals/bulk-ai
   * Executar ação de IA em massa
   */
  async bulkAIAction(req: Request, res: Response) {
    try {
      const { dealIds, command } = req.body;
      const { tenantId, userId } = req.user;

      if (!dealIds || !Array.isArray(dealIds) || dealIds.length === 0) {
        return res.status(400).json({ error: 'IDs de deals não fornecidos' });
      }

      if (!command) {
        return res.status(400).json({ error: 'Comando não fornecido' });
      }

      const results = [];
      let success = 0;
      let failed = 0;

      for (const dealId of dealIds) {
        try {
          // Buscar deal
          const deal = await prisma.deal.findFirst({
            where: { id: dealId, tenantId },
            include: { contact: true },
          });

          if (!deal) {
            failed++;
            results.push({ dealId, status: 'not_found' });
            continue;
          }

          // Enfileirar para processamento de IA
          // TODO: Implementar fila BullMQ
          // await bulkAIQueue.add('process-deal', {
          //   dealId,
          //   contactId: deal.contactId,
          //   command,
          //   tenantId,
          //   userId,
          // });

          success++;
          results.push({ dealId, status: 'queued' });
        } catch (error) {
          failed++;
          results.push({ dealId, status: 'error', error: error.message });
        }
      }

      res.json({
        success,
        failed,
        total: dealIds.length,
        results,
      });
    } catch (error) {
      console.error('Error bulk AI action:', error);
      res.status(500).json({ 
        error: 'Erro ao executar ação em massa',
        message: error.message 
      });
    }
  },

  /**
   * GET /api/deals/stats
   * Buscar estatísticas de deals
   */
  async getStats(req: Request, res: Response) {
    try {
      const { tenantId } = req.user;

      const [total, ganhos, perdidos, totalValue, ganhosValue] = await Promise.all([
        prisma.deal.count({ where: { tenantId } }),
        prisma.deal.count({ where: { tenantId, stage: 'ganho' } }),
        prisma.deal.count({ where: { tenantId, stage: 'perdido' } }),
        prisma.deal.aggregate({
          where: { tenantId },
          _sum: { value: true },
        }),
        prisma.deal.aggregate({
          where: { tenantId, stage: 'ganho' },
          _sum: { value: true },
        }),
      ]);

      res.json({
        total,
        totalValue: totalValue._sum.value || 0,
        ganhos,
        ganhosValue: ganhosValue._sum.value || 0,
        perdidos,
        taxaConversao: total > 0 ? (ganhos / total) * 100 : 0,
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar estatísticas',
        message: error.message 
      });
    }
  },

  /**
   * GET /api/deals/:id/history
   * Buscar histórico de mudanças do deal
   */
  async getHistory(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId } = req.user;

      const deal = await prisma.deal.findFirst({
        where: { id, tenantId },
      });

      if (!deal) {
        return res.status(404).json({ error: 'Deal não encontrado' });
      }

      const history = await prisma.dealHistory.findMany({
        where: { dealId: id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(history);
    } catch (error) {
      console.error('Error getting history:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar histórico',
        message: error.message 
      });
    }
  },
};

