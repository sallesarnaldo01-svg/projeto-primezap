import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * GET /api/reports/sales
 * Relatório de vendas
 */
export async function getSalesReport(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Deals fechados no período
    const deals = await prisma.deals.findMany({
      where: {
        ...(userId && req.user?.role !== 'ADMIN' ? { ownerId: userId } : {}),
        closedAt: { not: null, gte: start, lte: end },
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { closedAt: 'asc' }
    });

    // Agrupar por período
    const grouped: any = {};
    deals.forEach(deal => {
      if (!deal.closedAt) return;

      let key: string;
      const date = new Date(deal.closedAt);

      if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      } else if (groupBy === 'week') {
        const weekNum = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);
        key = `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else {
        key = date.toISOString().split('T')[0];
      }

      if (!grouped[key]) {
        grouped[key] = {
          period: key,
          count: 0,
          value: 0,
          deals: []
        };
      }

      grouped[key].count++;
      grouped[key].value += Number(deal.value ?? 0);
      grouped[key].deals.push({
        id: deal.id,
        title: deal.title,
        value: Number(deal.value ?? 0),
        assignedTo: deal.owner?.name
      });
    });

    const report = Object.values(grouped);

    // Calcular totais
    const totals = {
      count: deals.length,
      value: deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0),
      avgValue: deals.length > 0 ? deals.reduce((sum, d) => sum + Number(d.value ?? 0), 0) / deals.length : 0
    };

    res.json({
      report,
      totals,
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        groupBy
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error generating sales report');
    res.status(500).json({ error: 'Erro ao gerar relatório de vendas' });
  }
}

/**
 * GET /api/reports/performance
 * Relatório de performance da equipe
 */
export async function getPerformanceReport(req: AuthRequest, res: Response) {
  try {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    // Buscar usuários ativos
    const users = await prisma.public_users.findMany({
      where: {
        isActive: true,
        role: { in: ['agent', 'manager'] }
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true
      }
    });

    // Métricas por usuário
    const performance = await Promise.all(
      users.map(async (user) => {
        const [conversations, tickets, deals] = await Promise.all([
          // Total de conversas
          prisma.conversation.count({
            where: {
              userId: user.id,
              createdAt: { gte: start, lte: end }
            }
          }),
          
          // Tickets resolvidos
          prisma.ticket.count({
            where: {
              assignedToId: user.id,
              status: 'RESOLVED',
              resolvedAt: { gte: start, lte: end }
            }
          }),
          
          // Deals fechados
          prisma.deals.count({
            where: {
              ownerId: user.id,
              closedAt: { not: null, gte: start, lte: end }
            }
          })
        ]);

        return {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar
          },
          metrics: {
            conversations,
            tickets,
            deals,
            avgResponseTime: 0
          }
        };
      })
    );

    // Ordenar por número de conversas
    performance.sort((a, b) => b.metrics.conversations - a.metrics.conversations);

    res.json({
      performance,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error generating performance report');
    res.status(500).json({ error: 'Erro ao gerar relatório de performance' });
  }
}

/**
 * GET /api/reports/conversations
 * Relatório de conversas
 */
export async function getConversationsReport(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const where: any = {
      createdAt: { gte: start, lte: end }
    };

    if (userId && req.user?.role !== 'ADMIN') {
      where.userId = userId;
    }

    // Conversas por status
    const byStatus = await prisma.conversation.groupBy({
      by: ['status'],
      where,
      _count: { id: true }
    });

    // Conversas por dia
    const conversations = await prisma.conversation.findMany({
      where,
      select: {
        createdAt: true,
        status: true
      },
      orderBy: { createdAt: 'asc' }
    });

    const byDay: any = {};
    conversations.forEach(conv => {
      const day = conv.createdAt.toISOString().split('T')[0];
      if (!byDay[day]) {
        byDay[day] = { date: day, count: 0 };
      }
      byDay[day].count++;
    });

    res.json({
      byStatus,
      byDay: Object.values(byDay),
      total: conversations.length,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error generating conversations report');
    res.status(500).json({ error: 'Erro ao gerar relatório de conversas' });
  }
}

/**
 * GET /api/reports/campaigns
 * Relatório de campanhas
 */
export async function getCampaignsReport(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    const where: any = {
      createdAt: { gte: start, lte: end }
    };

    if (userId && req.user?.role !== 'ADMIN') {
      where.userId = userId;
    }

    const campaigns = await prisma.campaigns.findMany({
      where,
      include: {
        _count: {
          select: {
            messages: true
          }
        }
      }
    });

    const report = campaigns.map(campaign => ({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      totalMessages: campaign._count.messages,
      sentCount: campaign.sentCount || 0,
      deliveredCount: campaign.deliveredCount || 0,
      failedCount: campaign.failedCount || 0,
      deliveryRate: (campaign.sentCount || 0) > 0 
        ? (((campaign.deliveredCount || 0) / (campaign.sentCount || 1)) * 100).toFixed(2)
        : '0.00',
      createdAt: campaign.createdAt,
      completedAt: campaign.completedAt
    }));

    // Totais
    const totals = {
      campaigns: campaigns.length,
      totalMessages: campaigns.reduce((sum, c) => sum + c._count.messages, 0),
      totalSent: campaigns.reduce((sum, c) => sum + (c.sentCount || 0), 0),
      totalDelivered: campaigns.reduce((sum, c) => sum + (c.deliveredCount || 0), 0),
      totalFailed: campaigns.reduce((sum, c) => sum + (c.failedCount || 0), 0)
    };

    res.json({
      campaigns: report,
      totals,
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error generating campaigns report');
    res.status(500).json({ error: 'Erro ao gerar relatório de campanhas' });
  }
}

/**
 * GET /api/reports/export
 * Exporta relatório em formato CSV
 */
export async function exportReport(req: AuthRequest, res: Response) {
  try {
    const { type, startDate, endDate } = req.query;

    if (!type) {
      return res.status(400).json({ error: 'Tipo de relatório é obrigatório' });
    }

    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    let csvData = '';
    let filename = '';

    switch (type) {
      case 'sales': {
        const deals = await prisma.deals.findMany({
          where: {
            closedAt: { not: null, gte: start, lte: end }
          },
          include: {
            contact: { select: { name: true } },
            owner: { select: { name: true } }
          }
        });

        csvData = 'ID,Título,Valor,Contato,Responsável,Data de Fechamento\n';
        deals.forEach(deal => {
          csvData += `${deal.id},${deal.title},${Number(deal.value ?? 0)},${deal.contact?.name || ''},${deal.owner?.name || ''},${deal.closedAt?.toISOString()}\n`;
        });
        filename = `vendas_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv`;
        break;
      }

      case 'conversations': {
        const conversations = await prisma.conversation.findMany({
          where: {
            createdAt: { gte: start, lte: end }
          },
          include: {
            contact: { select: { name: true } },
            user: { select: { name: true } }
          }
        });

        csvData = 'ID,Contato,Status,Responsável,Data de Criação\n';
        conversations.forEach(conv => {
          csvData += `${conv.id},${conv.contact?.name || ''},${conv.status},${conv.user?.name || ''},${conv.createdAt.toISOString()}\n`;
        });
        filename = `conversas_${start.toISOString().split('T')[0]}_${end.toISOString().split('T')[0]}.csv`;
        break;
      }

      default:
        return res.status(400).json({ error: 'Tipo de relatório inválido' });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csvData); // BOM para UTF-8
  } catch (error) {
    logger.error({ error }, 'Error exporting report');
    res.status(500).json({ error: 'Erro ao exportar relatório' });
  }
}
