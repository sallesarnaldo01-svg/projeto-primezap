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
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { status, priority, assignedTo, search, page = '1', limit = '50' } = req.query;

    const where: any = { tenantId };
    
    // Filtrar por usuário se não for admin
    if (userId && req.user?.role !== 'ADMIN') {
      where.OR = [
        { assignedToId: userId },
        { createdById: userId }
      ];
    }
    
    if (status) {
      where.status = status;
    }
    
    if (priority) {
      where.priority = priority;
    }
    
    if (assignedTo) {
      where.assignedToId = assignedTo;
    }
    
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          contact: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true
            }
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: parseInt(limit as string)
      }),
      prisma.ticket.count({ where })
    ]);

    res.json({
      tickets,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
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
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    const where: any = { id, tenantId };
    
    if (userId && req.user?.role !== 'ADMIN') {
      where.OR = [
        { assignedToId: userId },
        { createdById: userId }
      ];
    }

    const ticket = await prisma.ticket.findFirst({
      where,
      include: {
        contact: true,
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        conversation: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

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
    const userId = req.user?.userId;
    const { title, description, contactId, conversationId, priority, category } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
    }

    const ticket = await prisma.ticket.create({
      data: {
        tenantId: req.user!.tenantId!,
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
        tenantId: req.user!.tenantId!,
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
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const { title, description, status, priority, category, resolution } = req.body;

    const existing = await prisma.ticket.findFirst({
      where: { id, tenantId }
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
          tenantId: tenantId!,
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
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    if (!assignedToId) {
      return res.status(400).json({ error: 'ID do usuário é obrigatório' });
    }

    const ticket = await prisma.ticket.findFirst({
      where: { id, tenantId }
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    // Verificar se o usuário existe
    const user = await prisma.public_users.findUnique({
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
        tenantId: tenantId!,
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
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;

    const ticket = await prisma.ticket.findFirst({
      where: { id, tenantId }
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
        tenantId: tenantId!,
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
    const userId = req.user?.userId;
    const tenantId = req.user?.tenantId;
    const isAdmin = req.user?.role === 'ADMIN';

    const where: any = { tenantId };
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
