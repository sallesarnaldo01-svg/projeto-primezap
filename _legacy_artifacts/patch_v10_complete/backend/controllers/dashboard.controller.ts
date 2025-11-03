import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middlewares/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/dashboard/metrics
 * Retorna métricas gerais do dashboard
 */
router.get('/metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;

    // Período (padrão: últimos 30 dias)
    const { period = '30d' } = req.query;
    const daysAgo = parseInt(period.toString().replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Total de conversas
    const totalConversations = await prisma.conversation.count({
      where: {
        tenantId,
        createdAt: { gte: startDate }
      }
    });

    // Total de mensagens
    const totalMessages = await prisma.message.count({
      where: {
        conversation: { tenantId },
        createdAt: { gte: startDate }
      }
    });

    // Total de tickets
    const totalTickets = await prisma.ticket.count({
      where: {
        tenantId,
        createdAt: { gte: startDate }
      }
    });

    // Total de deals
    const totalDeals = await prisma.deal.count({
      where: {
        tenantId,
        createdAt: { gte: startDate }
      }
    });

    // Valor total de deals
    const dealsValue = await prisma.deal.aggregate({
      where: {
        tenantId,
        status: 'won',
        closedAt: { gte: startDate }
      },
      _sum: { value: true }
    });

    // Taxa de conversão
    const wonDeals = await prisma.deal.count({
      where: {
        tenantId,
        status: 'won',
        closedAt: { gte: startDate }
      }
    });

    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;

    // Tempo médio de resposta (em minutos)
    const avgResponseTime = await prisma.$queryRaw<Array<{ avg: number }>>`
      SELECT AVG(EXTRACT(EPOCH FROM (m2.created_at - m1.created_at)) / 60) as avg
      FROM messages m1
      JOIN messages m2 ON m2.conversation_id = m1.conversation_id
      WHERE m1.sender = 'contact'
      AND m2.sender = 'agent'
      AND m2.created_at > m1.created_at
      AND m1.created_at >= ${startDate}
      AND m2.created_at >= ${startDate}
    `;

    const avgResponse = avgResponseTime[0]?.avg || 0;

    // Tickets por status
    const ticketsByStatus = await prisma.ticket.groupBy({
      by: ['status'],
      where: {
        tenantId,
        createdAt: { gte: startDate }
      },
      _count: true
    });

    res.json({
      metrics: {
        totalConversations,
        totalMessages,
        totalTickets,
        totalDeals,
        dealsValue: dealsValue._sum.value || 0,
        conversionRate: Math.round(conversionRate * 10) / 10,
        avgResponseTime: Math.round(avgResponse * 10) / 10
      },
      ticketsByStatus: ticketsByStatus.map(t => ({
        status: t.status,
        count: t._count
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard metrics' });
  }
});

/**
 * GET /api/dashboard/funnel
 * Retorna dados do funil de vendas
 */
router.get('/funnel', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;

    const { period = '30d' } = req.query;
    const daysAgo = parseInt(period.toString().replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    // Deals por estágio
    const dealsByStage = await prisma.deal.groupBy({
      by: ['stage'],
      where: {
        tenantId,
        createdAt: { gte: startDate }
      },
      _count: true,
      _sum: { value: true }
    });

    // Ordenar por estágio
    const stageOrder = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];
    const sortedStages = dealsByStage.sort((a, b) => 
      stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
    );

    res.json({
      funnel: sortedStages.map(stage => ({
        stage: stage.stage,
        count: stage._count,
        value: stage._sum.value || 0
      }))
    });
  } catch (error) {
    console.error('Error fetching funnel data:', error);
    res.status(500).json({ error: 'Failed to fetch funnel data' });
  }
});

/**
 * GET /api/dashboard/activity
 * Retorna atividades recentes
 */
router.get('/activity', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = (req as any).user.tenantId;
    const { limit = '10' } = req.query;

    // Buscar últimas atividades (conversas, tickets, deals)
    const recentConversations = await prisma.conversation.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit.toString()) / 3,
      include: {
        contact: { select: { name: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true }
        }
      }
    });

    const recentTickets = await prisma.ticket.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit.toString()) / 3,
      include: {
        contact: { select: { name: true } },
        assignedTo: { select: { name: true } }
      }
    });

    const recentDeals = await prisma.deal.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      take: parseInt(limit.toString()) / 3,
      include: {
        contact: { select: { name: true } }
      }
    });

    // Combinar e ordenar por data
    const activities = [
      ...recentConversations.map(c => ({
        type: 'conversation',
        id: c.id,
        title: `Nova mensagem de ${c.contact?.name || 'Desconhecido'}`,
        description: c.messages[0]?.content?.substring(0, 100) || '',
        timestamp: c.updatedAt
      })),
      ...recentTickets.map(t => ({
        type: 'ticket',
        id: t.id,
        title: `Ticket #${t.id} - ${t.subject}`,
        description: `Atribuído a ${t.assignedTo?.name || 'Ninguém'}`,
        timestamp: t.updatedAt
      })),
      ...recentDeals.map(d => ({
        type: 'deal',
        id: d.id,
        title: `Deal: ${d.title}`,
        description: `Valor: R$ ${d.value?.toFixed(2) || '0.00'}`,
        timestamp: d.updatedAt
      }))
    ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
     .slice(0, parseInt(limit.toString()));

    res.json({ activities });
  } catch (error) {
    console.error('Error fetching activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

/**
 * GET /api/dashboard/tasks
 * Retorna tarefas do dia
 */
router.get('/tasks', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const tenantId = (req as any).user.tenantId;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Tarefas do dia
    const tasks = await prisma.task.findMany({
      where: {
        tenantId,
        assignedToId: userId,
        dueDate: {
          gte: today,
          lt: tomorrow
        },
        status: { not: 'completed' }
      },
      orderBy: { dueDate: 'asc' },
      include: {
        deal: { select: { title: true } },
        ticket: { select: { subject: true } }
      }
    });

    res.json({ tasks });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

export default router;

