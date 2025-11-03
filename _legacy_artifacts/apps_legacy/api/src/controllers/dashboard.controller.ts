import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * GET /api/dashboard/metrics
 * Retorna métricas principais do dashboard
 */
export async function getMetrics(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    // Buscar métricas em paralelo
    const [
      totalConversations,
      activeConversations,
      totalContacts,
      totalCampaigns,
      activeCampaigns,
      conversationsToday,
      conversationsThisWeek,
      conversationsThisMonth
    ] = await Promise.all([
      // Total de conversas
      prisma.conversation.count({
        where: userId ? { userId } : {}
      }),
      
      // Conversas ativas (últimas 24h)
      prisma.conversation.count({
        where: {
          ...(userId ? { userId } : {}),
          updatedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Total de contatos
      prisma.contact.count({
        where: userId ? { userId } : {}
      }),
      
      // Total de campanhas
      prisma.campaign.count({
        where: userId ? { userId } : {}
      }),
      
      // Campanhas ativas
      prisma.campaign.count({
        where: {
          ...(userId ? { userId } : {}),
          status: 'ACTIVE'
        }
      }),
      
      // Conversas hoje
      prisma.conversation.count({
        where: {
          ...(userId ? { userId } : {}),
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      
      // Conversas esta semana
      prisma.conversation.count({
        where: {
          ...(userId ? { userId } : {}),
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        }
      }),
      
      // Conversas este mês
      prisma.conversation.count({
        where: {
          ...(userId ? { userId } : {}),
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })
    ]);

    // Calcular taxa de crescimento
    const growthRate = conversationsThisWeek > 0 
      ? ((conversationsToday / conversationsThisWeek) * 100).toFixed(1)
      : '0.0';

    res.json({
      metrics: {
        conversations: {
          total: totalConversations,
          active: activeConversations,
          today: conversationsToday,
          thisWeek: conversationsThisWeek,
          thisMonth: conversationsThisMonth,
          growthRate: parseFloat(growthRate)
        },
        contacts: {
          total: totalContacts
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching dashboard metrics');
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
}

/**
 * GET /api/dashboard/funnel
 * Retorna dados do funil de vendas
 */
export async function getFunnel(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    // Buscar deals por estágio
    const dealsByStage = await prisma.deal.groupBy({
      by: ['stage'],
      where: {
        ...(userId ? { userId } : {})
      },
      _count: {
        id: true
      },
      _sum: {
        value: true
      }
    });

    // Calcular taxa de conversão
    const totalDeals = dealsByStage.reduce((acc, deal) => acc + deal._count.id, 0);
    const wonDeals = dealsByStage
      .filter(deal => deal.stage === 'WON')
      .reduce((acc, deal) => acc + deal._count.id, 0);

    const conversionRate = totalDeals > 0
      ? parseFloat(((wonDeals / totalDeals) * 100).toFixed(1))
      : 0;

    res.json({
      funnel: dealsByStage.map(deal => ({
        stage: deal.stage,
        count: deal._count.id,
        value: deal._sum.value || 0
      })),
      conversionRate,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching funnel data');
    res.status(500).json({ error: 'Erro ao buscar dados do funil' });
  }
}

/**
 * GET /api/dashboard/tickets-by-status
 * Retorna o número de tickets por status
 */
export async function getTicketsByStatus(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;

    const tickets = await prisma.ticket.findMany({
      where: userId ? { assignedToId: userId } : {},
      select: {
        status: true,
        _count: {
          select: { id: true }
        }
      },
      groupBy: {
        status: true
      } as any
    });

    const statusData = tickets.map(ticket => ({
      status: ticket.status,
      count: ticket._count.id
    }));

    res.json({
      tickets: statusData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching tickets by status');
    res.status(500).json({ error: 'Erro ao buscar tickets' });
  }
}

/**
 * GET /api/dashboard/recent-activity
 * Retorna atividades recentes
 */
export async function getRecentActivity(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const activities = await prisma.activity.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true
          }
        }
      }
    });

    res.json({
      activities,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching recent activity');
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
}

/**
 * GET /api/dashboard/performance
 * Retorna métricas de performance da equipe
 */
export async function getPerformance(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const period = req.query.period as string || 'week'; // day, week, month

    let startDate: Date;
    switch (period) {
      case 'day':
        startDate = new Date(new Date().setHours(0, 0, 0, 0));
        break;
      case 'month':
        startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        break;
      case 'week':
      default:
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    // Métricas de performance
    const [avgResponseTime, avgResolutionTime, satisfactionRate] = await Promise.all([
      // Tempo médio de resposta (em minutos)
      prisma.conversation.aggregate({
        where: {
          ...(userId ? { userId } : {}),
          firstResponseAt: { not: null },
          createdAt: { gte: startDate }
        },
        _avg: {
          responseTimeMinutes: true
        }
      }),
      
      // Tempo médio de resolução (em horas)
      prisma.ticket.aggregate({
        where: {
          ...(userId ? { assignedToId: userId } : {}),
          status: 'RESOLVED',
          resolvedAt: { not: null },
          createdAt: { gte: startDate }
        },
        _avg: {
          resolutionTimeHours: true
        }
      }),
      
      // Taxa de satisfação (CSAT)
      prisma.feedback.aggregate({
        where: {
          ...(userId ? { userId } : {}),
          createdAt: { gte: startDate }
        },
        _avg: {
          rating: true
        }
      })
    ]);

    res.json({
      performance: {
        avgResponseTime: avgResponseTime._avg.responseTimeMinutes || 0,
        avgResolutionTime: avgResolutionTime._avg.resolutionTimeHours || 0,
        satisfactionRate: satisfactionRate._avg.rating || 0,
        period
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching performance metrics');
    res.status(500).json({ error: 'Erro ao buscar performance' });
  }
}

