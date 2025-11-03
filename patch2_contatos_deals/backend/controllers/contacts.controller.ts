/**
 * Contacts Controller - Backend API
 * Primeflow-Hub - Patch 2
 * 
 * Controller para gerenciamento de contatos
 */

import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import Papa from 'papaparse';
import { z } from 'zod';

// Schema de validação
const contactSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  phone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('Email inválido').optional(),
  tags: z.array(z.string()).optional(),
  origem: z.string().optional(),
  leadStatus: z.string().optional(),
});

export const contactsController = {
  /**
   * GET /api/contacts
   * Listar todos os contatos com filtros
   */
  async listContacts(req: Request, res: Response) {
    try {
      const { tenantId } = req.user;
      const { search, tags, origem, leadStatus } = req.query;

      let where: any = { tenantId };

      // Filtro de busca
      if (search) {
        where.OR = [
          { name: { contains: search as string, mode: 'insensitive' } },
          { phone: { contains: search as string } },
          { email: { contains: search as string, mode: 'insensitive' } },
        ];
      }

      // Filtro de tags
      if (tags) {
        const tagsArray = (tags as string).split(',');
        where.tags = { hasSome: tagsArray };
      }

      // Filtro de origem
      if (origem) {
        where.origem = origem;
      }

      // Filtro de status de lead
      if (leadStatus) {
        where.leadStatus = leadStatus;
      }

      const contacts = await prisma.contact.findMany({
        where,
        include: {
          _count: {
            select: { conversations: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json(contacts);
    } catch (error) {
      console.error('Error listing contacts:', error);
      res.status(500).json({ 
        error: 'Erro ao listar contatos',
        message: error.message 
      });
    }
  },

  /**
   * GET /api/contacts/:id
   * Buscar contato por ID
   */
  async getContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId } = req.user;

      const contact = await prisma.contact.findFirst({
        where: { id, tenantId },
        include: {
          conversations: {
            orderBy: { lastMessageAt: 'desc' },
            take: 5,
          },
          deals: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      res.json(contact);
    } catch (error) {
      console.error('Error getting contact:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar contato',
        message: error.message 
      });
    }
  },

  /**
   * POST /api/contacts
   * Criar novo contato
   */
  async createContact(req: Request, res: Response) {
    try {
      const { tenantId } = req.user;
      
      // Validar dados
      const validatedData = contactSchema.parse(req.body);

      // Verificar se já existe contato com mesmo telefone
      const existing = await prisma.contact.findFirst({
        where: {
          tenantId,
          phone: validatedData.phone,
        },
      });

      if (existing) {
        return res.status(409).json({ 
          error: 'Já existe um contato com este telefone' 
        });
      }

      const contact = await prisma.contact.create({
        data: {
          tenantId,
          name: validatedData.name,
          phone: validatedData.phone,
          email: validatedData.email,
          tags: validatedData.tags || [],
          origem: validatedData.origem || 'manual',
          leadStatus: validatedData.leadStatus || 'novo',
        },
      });

      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: error.errors 
        });
      }

      console.error('Error creating contact:', error);
      res.status(500).json({ 
        error: 'Erro ao criar contato',
        message: error.message 
      });
    }
  },

  /**
   * PUT /api/contacts/:id
   * Atualizar contato
   */
  async updateContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId } = req.user;

      // Verificar se contato existe
      const existing = await prisma.contact.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      // Validar dados (parcial)
      const validatedData = contactSchema.partial().parse(req.body);

      const contact = await prisma.contact.update({
        where: { id },
        data: {
          ...validatedData,
          updatedAt: new Date(),
        },
      });

      res.json(contact);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: error.errors 
        });
      }

      console.error('Error updating contact:', error);
      res.status(500).json({ 
        error: 'Erro ao atualizar contato',
        message: error.message 
      });
    }
  },

  /**
   * DELETE /api/contacts/:id
   * Deletar contato
   */
  async deleteContact(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId } = req.user;

      // Verificar se contato existe
      const existing = await prisma.contact.findFirst({
        where: { id, tenantId },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      await prisma.contact.delete({
        where: { id },
      });

      res.json({ success: true, message: 'Contato deletado com sucesso' });
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ 
        error: 'Erro ao deletar contato',
        message: error.message 
      });
    }
  },

  /**
   * POST /api/contacts/import
   * Importar contatos de arquivo CSV
   */
  async importCSV(req: Request, res: Response) {
    try {
      const { tenantId } = req.user;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'Arquivo não enviado' });
      }

      // Parse CSV
      const csvData = file.buffer.toString('utf-8');
      const { data: rows, errors } = Papa.parse(csvData, { 
        header: true,
        skipEmptyLines: true,
      });

      if (errors.length > 0) {
        return res.status(400).json({ 
          error: 'Erro ao processar CSV',
          details: errors 
        });
      }

      let imported = 0;
      let failed = 0;
      const failedRows: any[] = [];

      // Importar cada linha
      for (const row of rows as any[]) {
        try {
          // Validar dados mínimos
          if (!row.name || !row.phone) {
            failed++;
            failedRows.push({ row, reason: 'Nome ou telefone faltando' });
            continue;
          }

          // Criar ou atualizar contato
          await prisma.contact.upsert({
            where: {
              tenantId_phone: {
                tenantId,
                phone: row.phone,
              },
            },
            update: {
              name: row.name,
              email: row.email || null,
              tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
              origem: row.origem || 'importacao',
            },
            create: {
              tenantId,
              name: row.name,
              phone: row.phone,
              email: row.email || null,
              tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
              origem: row.origem || 'importacao',
              leadStatus: row.leadStatus || 'novo',
            },
          });

          imported++;
        } catch (error) {
          failed++;
          failedRows.push({ row, reason: error.message });
        }
      }

      res.json({
        success: true,
        imported,
        failed,
        total: rows.length,
        failedRows: failedRows.length > 0 ? failedRows : undefined,
      });
    } catch (error) {
      console.error('Error importing CSV:', error);
      res.status(500).json({ 
        error: 'Erro ao importar CSV',
        message: error.message 
      });
    }
  },

  /**
   * GET /api/contacts/:id/timeline
   * Buscar timeline de atividades do contato
   */
  async getTimeline(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { tenantId } = req.user;

      // Verificar se contato existe
      const contact = await prisma.contact.findFirst({
        where: { id, tenantId },
      });

      if (!contact) {
        return res.status(404).json({ error: 'Contato não encontrado' });
      }

      // Buscar atividades
      const activities = await prisma.contactActivity.findMany({
        where: { contactId: id },
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
        take: 50,
      });

      res.json(activities);
    } catch (error) {
      console.error('Error getting timeline:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar timeline',
        message: error.message 
      });
    }
  },

  /**
   * GET /api/contacts/stats
   * Buscar estatísticas de contatos
   */
  async getStats(req: Request, res: Response) {
    try {
      const { tenantId } = req.user;

      const [total, leads, qualificados, convertidos] = await Promise.all([
        prisma.contact.count({ where: { tenantId } }),
        prisma.contact.count({ 
          where: { 
            tenantId,
            tags: { has: 'lead' },
          } 
        }),
        prisma.contact.count({ 
          where: { 
            tenantId,
            leadStatus: 'qualificado',
          } 
        }),
        prisma.contact.count({ 
          where: { 
            tenantId,
            leadStatus: 'convertido',
          } 
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
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar estatísticas',
        message: error.message 
      });
    }
  },
};

