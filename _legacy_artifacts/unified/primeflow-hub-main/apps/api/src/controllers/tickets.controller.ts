import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * GET /api/tickets
 * Lista todos os tickets
 */
export async function getTickets(req: AuthRequest, res: Response) {
  try {
    const tenantId = (req as any).user?.tenantId;
    const userId = (req as any).user?.id;
    const { status, priority, assignedTo, search, page = '1', limit = '50' } = req.query as any;

    const pageNum = parseInt(page as string) || 1;
    const limitNum = parseInt(limit as string) || 50;
    const offset = (pageNum - 1) * limitNum;

    const whereSql: string[] = [];
    const params: any[] = [];
    if (tenantId) {
      whereSql.push(`t.tenant_id = $${params.length + 1}`);
      params.push(tenantId);
    }
    if (status) {
      whereSql.push(`t.status = $${params.length + 1}`);
      params.push(String(status));
    }
    if (priority) {
      whereSql.push(`t.priority = $${params.length + 1}`);
      params.push(String(priority));
    }
    if (assignedTo) {
      whereSql.push(`t.assigned_to_id = $${params.length + 1}`);
      params.push(String(assignedTo));
    }
    if (search) {
      whereSql.push(`(t.title ILIKE $${params.length + 1} OR t.description ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    if (userId && (req as any).user?.role !== 'ADMIN') {
      whereSql.push(`(t.assigned_to_id = $${params.length + 1} OR t.created_by_id = $${params.length + 1})`);
      params.push(userId);
    }
    const whereClause = whereSql.length ? `WHERE ${whereSql.join(' AND ')}` : '';

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
              t.contact_id as "contactId", t.assigned_to_id as "assignedToId",
              t.created_by_id as "createdById", t.conversation_id as "conversationId",
              t.created_at as "createdAt", t.updated_at as "updatedAt"
       FROM public.tickets t
       ${whereClause}
       ORDER BY t.priority DESC, t.created_at DESC
       LIMIT ${limitNum} OFFSET ${offset}`,
      ...params
    );
    const totRes: Array<{ count: string }> = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::text as count FROM public.tickets t ${whereClause}`,
      ...params
    );

    res.json({
      tickets: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(totRes[0]?.count ?? '0', 10),
        pages: Math.ceil(parseInt(totRes[0]?.count ?? '0', 10) / limitNum)
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching tickets');
    res.status(500).json({ error: 'Erro ao buscar tickets' });
  }
}

/**
 * GET /api/tickets/:id
 * Busca um ticket específico
 */
export async function getTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const tenantId = (req as any).user?.tenantId;
    const userId = (req as any).user?.id;

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT t.id, t.title, t.description, t.status, t.priority, t.category,
              t.contact_id as "contactId", t.assigned_to_id as "assignedToId",
              t.created_by_id as "createdById", t.conversation_id as "conversationId",
              t.created_at as "createdAt", t.updated_at as "updatedAt"
       FROM public.tickets t
       WHERE t.id = $1 ${tenantId ? 'AND t.tenant_id = $2' : ''}
         ${userId && (req as any).user?.role !== 'ADMIN' ? 'AND (t.assigned_to_id = $3 OR t.created_by_id = $3)' : ''}
       LIMIT 1`,
      ...(tenantId ? [id, tenantId, userId] : [id, userId])
    );
    const ticket = rows[0];

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    res.json(ticket);
  } catch (error) {
    logger.error({ error }, 'Error fetching ticket');
    res.status(500).json({ error: 'Erro ao buscar ticket' });
  }
}

/**
 * POST /api/tickets
 * Cria um novo ticket
 */
export async function createTicket(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { title, description, contactId, conversationId, priority, category } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    }

    const ticket = await prisma.ticket.create({
      data: {
        title,
        description,
        contactId,
        conversationId,
        priority: priority || 'MEDIUM',
        category,
        status: 'OPEN',
        createdById: userId!
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        type: 'TICKET_CREATED',
        description: `Ticket "${title}" criado`,
        userId: userId!,
        metadata: { ticketId: ticket.id }
      }
    });

    logger.info({ ticketId: ticket.id }, 'Ticket created');
    res.status(201).json(ticket);
  } catch (error) {
    logger.error({ error }, 'Error creating ticket');
    res.status(500).json({ error: 'Erro ao criar ticket' });
  }
}

/**
 * PUT /api/tickets/:id
 * Atualiza um ticket
 */
export async function updateTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { title, description, status, priority, category, resolution } = req.body;

    const existing = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(status && { status }),
        ...(priority && { priority }),
        ...(category && { category }),
        ...(resolution && { resolution }),
        ...(status === 'RESOLVED' && { resolvedAt: new Date() }),
        ...(status === 'CLOSED' && { closedAt: new Date() })
      },
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Registrar atividade se mudou de status
    if (status && status !== existing.status) {
      await prisma.activity.create({
        data: {
          type: 'TICKET_STATUS_CHANGED',
          description: `Ticket "${ticket.title}" mudou de ${existing.status} para ${status}`,
          userId: userId!,
          metadata: { ticketId: ticket.id, oldStatus: existing.status, newStatus: status }
        }
      });
    }

    logger.info({ ticketId: ticket.id }, 'Ticket updated');
    res.json(ticket);
  } catch (error) {
    logger.error({ error }, 'Error updating ticket');
    res.status(500).json({ error: 'Erro ao atualizar ticket' });
  }
}

/**
 * PUT /api/tickets/:id/assign
 * Atribui ticket a um usuário
 */
export async function assignTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { assignedToId } = req.body;
    const userId = req.user?.id;

    if (!assignedToId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Verificar se o usuário existe
    const user = await prisma.user.findUnique({
      where: { id: assignedToId }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        assignedToId,
        status: ticket.status === 'OPEN' ? 'IN_PROGRESS' : ticket.status
      },
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        type: 'TICKET_ASSIGNED',
        description: `Ticket "${ticket.title}" atribuído a ${user.name}`,
        userId: userId!,
        metadata: { ticketId: ticket.id, assignedToId }
      }
    });

    logger.info({ ticketId: id, assignedToId }, 'Ticket assigned');
    res.json(updatedTicket);
  } catch (error) {
    logger.error({ error }, 'Error assigning ticket');
    res.status(500).json({ error: 'Erro ao atribuir ticket' });
  }
}

/**
 * DELETE /api/tickets/:id
 * Deleta um ticket
 */
export async function deleteTicket(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const ticket = await prisma.ticket.findUnique({
      where: { id }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Apenas admin ou criador pode deletar
    if (req.user?.role !== 'ADMIN' && ticket.createdById !== userId) {
      return res.status(403).json({ error: 'Sem permissão para deletar este ticket' });
    }

    await prisma.ticket.delete({
      where: { id }
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        type: 'TICKET_DELETED',
        description: `Ticket "${ticket.title}" deletado`,
        userId: userId!,
        metadata: { ticketId: id }
      }
    });

    logger.info({ ticketId: id }, 'Ticket deleted');
    res.json({ message: 'Ticket deletado com sucesso' });
  } catch (error) {
    logger.error({ error }, 'Error deleting ticket');
    res.status(500).json({ error: 'Erro ao deletar ticket' });
  }
}

/**
 * GET /api/tickets/stats
 * Retorna estatísticas de tickets
 */
export async function getTicketStats(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.role === 'ADMIN';

    const where: any = {};
    if (!isAdmin && userId) {
      where.OR = [
        { assignedToId: userId },
        { createdById: userId }
      ];
    }

    const [byStatus, byPriority, avgResolutionTime] = await Promise.all([
      prisma.ticket.groupBy({
        by: ['status'],
        where,
        _count: { id: true }
      }),
      prisma.ticket.groupBy({
        by: ['priority'],
        where,
        _count: { id: true }
      }),
      prisma.ticket.aggregate({
        where: {
          ...where,
          status: 'RESOLVED',
          resolvedAt: { not: null }
        },
        _avg: {
          resolutionTimeHours: true
        }
      })
    ]);

    res.json({
      byStatus,
      byPriority,
      avgResolutionTime: avgResolutionTime._avg.resolutionTimeHours || 0
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching ticket stats');
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}
