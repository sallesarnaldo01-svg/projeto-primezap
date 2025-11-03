import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { AuthRequest } from '../middleware/auth.js';

const ACTIVE_CAMPAIGN_STATUSES = ['ACTIVE', 'RUNNING', 'IN_PROGRESS', 'LIVE', 'ATIVA', 'ATIVO'];

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === 'object' && value && 'toNumber' in (value as Record<string, unknown>)) {
    try {
      return Number((value as { toNumber: () => number }).toNumber());
    } catch {
      return 0;
    }
  }
  return 0;
};

const clampPercentage = (value: number) => Math.max(0, Math.min(100, value));

const getRequestContext = (req: AuthRequest) => {
  const userId = req.user?.userId ?? req.user?.id ?? null;
  const tenantId = req.user?.tenantId ?? null;
  const rawRole = req.user?.role;
  const normalizedRole =
    typeof rawRole === 'string' ? rawRole.toUpperCase() : String(rawRole ?? 'AGENT');
  const restrictToUser = normalizedRole !== 'ADMIN' && !!userId;
  return { userId, tenantId, role: normalizedRole, restrictToUser };
};

const tableExists = async (tableName: string) => {
  const result = await prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS "exists";
  `);
  return result[0]?.exists ?? false;
};

const columnExists = async (tableName: string, columnName: string) => {
  const result = await prisma.$queryRaw<{ exists: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
        AND column_name = ${columnName}
    ) AS "exists";
  `);
  return result[0]?.exists ?? false;
};

export async function getMetrics(req: AuthRequest, res: Response) {
  try {
    const { userId, tenantId, restrictToUser } = getRequestContext(req);

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const conversationFilter: Prisma.conversationsWhereInput = {
      ...(tenantId ? { contacts: { tenant_id: tenantId } } : {}),
    };

    if (restrictToUser && userId) {
      conversationFilter.OR = [
        { user_id: userId },
        { assigned_to: userId },
      ];
    }

    const contactFilter: Prisma.contactsWhereInput = {
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    if (restrictToUser && userId) {
      contactFilter.OR = [
        { user_id: userId },
        { activities: { some: { user_id: userId } } },
      ];
    }

    const campaignFilter: Prisma.campaignsWhereInput = {};
    if (restrictToUser && userId) {
      campaignFilter.user_id = userId;
    }

    const activeCampaignFilter: Prisma.campaignsWhereInput = {
      ...campaignFilter,
      OR: ACTIVE_CAMPAIGN_STATUSES.map((status) => ({
        status: { equals: status, mode: 'insensitive' },
      })),
    };

    const [
      totalConversations,
      activeConversations,
      conversationsToday,
      conversationsThisWeek,
      conversationsThisMonth,
      totalContacts,
      totalCampaigns,
      activeCampaigns,
    ] = await Promise.all([
      prisma.conversations.count({ where: conversationFilter }),
      prisma.conversations.count({
        where: {
          ...conversationFilter,
          updated_at: { gte: last24h },
        },
      }),
      prisma.conversations.count({
        where: {
          ...conversationFilter,
          created_at: { gte: startOfDay },
        },
      }),
      prisma.conversations.count({
        where: {
          ...conversationFilter,
          created_at: { gte: startOfWeek },
        },
      }),
      prisma.conversations.count({
        where: {
          ...conversationFilter,
          created_at: { gte: startOfMonth },
        },
      }),
      prisma.contacts.count({ where: contactFilter }),
      prisma.campaigns.count({ where: campaignFilter }),
      prisma.campaigns.count({ where: activeCampaignFilter }),
    ]);

    const growthRate =
      conversationsThisWeek > 0
        ? Math.round((conversationsToday / conversationsThisWeek) * 1000) / 10
        : 0;

    res.json({
      metrics: {
        conversations: {
          total: totalConversations,
          active: activeConversations,
          today: conversationsToday,
          thisWeek: conversationsThisWeek,
          thisMonth: conversationsThisMonth,
          growthRate: clampPercentage(growthRate),
        },
        contacts: {
          total: totalContacts,
        },
        campaigns: {
          total: totalCampaigns,
          active: activeCampaigns,
        },
      },
      timestamp: now.toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching dashboard metrics');
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
}

export async function getFunnel(req: AuthRequest, res: Response) {
  try {
    const { userId, tenantId, restrictToUser } = getRequestContext(req);

    const dealFilter: Prisma.dealsWhereInput = {
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    if (restrictToUser && userId) {
      dealFilter.OR = [
        { owner_id: userId },
        { contact: { user_id: userId } },
      ];
    }

    const stageStats = await prisma.deals.groupBy({
      by: ['stage_id'],
      where: dealFilter,
      _count: { _all: true },
      _sum: { value: true },
    });

    const stageIds = stageStats
      .map((stage) => stage.stage_id)
      .filter((stageId): stageId is string => !!stageId);

    const stageNameMap =
      stageIds.length > 0
        ? new Map(
            (
              await prisma.stages.findMany({
                where: { id: { in: stageIds } },
                select: { id: true, name: true },
              })
            ).map((stage) => [stage.id, stage.name ?? 'Sem estágio']),
          )
        : new Map<string, string>();

    const funnel = stageStats.map((stage) => ({
      stage: stage.stage_id ? stageNameMap.get(stage.stage_id) ?? 'Sem estágio' : 'Sem estágio',
      count: stage._count._all,
      value: toNumber(stage._sum.value),
    }));

    const totalDeals = funnel.reduce((sum, stage) => sum + stage.count, 0);

    const wonDealsCount = await prisma.deals.count({
      where: {
        ...dealFilter,
        OR: [
          { closed_at: { not: null } },
          { stages: { name: { contains: 'won', mode: 'insensitive' } } },
          { stages: { name: { contains: 'ganh', mode: 'insensitive' } } },
        ],
      },
    });

    const conversionRate =
      totalDeals > 0 ? Math.round((wonDealsCount / totalDeals) * 1000) / 10 : 0;

    res.json({
      funnel,
      conversionRate: clampPercentage(conversionRate),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching funnel data');
    res.status(500).json({ error: 'Erro ao buscar funil' });
  }
}

export async function getTicketsByStatus(req: AuthRequest, res: Response) {
  try {
    const { tenantId } = getRequestContext(req);
    const ticketsExists = await tableExists('tickets');

    if (!ticketsExists) {
      logger.debug('tickets table not found, returning empty dataset');
      res.json({ tickets: [], timestamp: new Date().toISOString() });
      return;
    }

    const tenantColumn = tenantId ? await columnExists('tickets', 'tenant_id') : false;
    const whereClause =
      tenantId && tenantColumn ? Prisma.sql`WHERE tenant_id = ${tenantId}::uuid` : Prisma.empty;

    const rows = await prisma.$queryRaw<{ status: string | null; count: bigint }[]>(Prisma.sql`
      SELECT status, COUNT(*)::bigint AS count
      FROM tickets
      ${whereClause}
      GROUP BY status
      ORDER BY count DESC
      LIMIT 50;
    `);

    const tickets = rows.map((row) => ({
      status: row.status ?? 'desconhecido',
      count: Number(row.count ?? 0),
    }));

    res.json({ tickets, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ error }, 'Error fetching tickets by status');
    res.status(500).json({ error: 'Erro ao buscar tickets' });
  }
}

export async function getRecentActivity(req: AuthRequest, res: Response) {
  try {
    const { userId, tenantId, restrictToUser } = getRequestContext(req);
    const limitParam = parseInt(req.query.limit as string, 10);
    const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 10;

    const activities = await prisma.contact_activities.findMany({
      where: {
        ...(tenantId ? { contact: { tenant_id: tenantId } } : {}),
        ...(restrictToUser && userId
          ? {
              OR: [
                { user_id: userId },
                { contact: { user_id: userId } },
              ],
            }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        contact: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: limit,
    });

    const data = activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      description: activity.description ?? '',
      createdAt: activity.created_at?.toISOString() ?? new Date().toISOString(),
      contact: activity.contact
        ? {
            id: activity.contact.id,
            name: activity.contact.name,
            email: activity.contact.email,
            phone: activity.contact.phone,
          }
        : undefined,
      user: activity.user
        ? {
            id: activity.user.id,
            name: activity.user.name,
            email: activity.user.email,
            avatar: activity.user.avatar ?? null,
          }
        : undefined,
    }));

    res.json({ activities: data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error({ error }, 'Error fetching recent activity');
    res.status(500).json({ error: 'Erro ao buscar atividades' });
  }
}

export async function getPerformance(req: AuthRequest, res: Response) {
  try {
    const { userId, tenantId, restrictToUser } = getRequestContext(req);
    const period = (req.query.period as string) || 'week';

    const now = new Date();
    let startDate: Date;
    switch (period) {
      case 'day':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'week':
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
    }

    const tenantConversationFilter = tenantId
      ? Prisma.sql`AND ct.tenant_id = ${tenantId}::uuid`
      : Prisma.empty;
    const userConversationFilter =
      restrictToUser && userId
        ? Prisma.sql`AND (c.assigned_to = ${userId} OR c.user_id = ${userId})`
        : Prisma.empty;

    const [responseRows, resolutionRows] = await Promise.all([
      prisma.$queryRaw<{ avg_minutes: number | null }[]>(Prisma.sql`
        SELECT AVG(gap_minutes) AS avg_minutes
        FROM (
          SELECT
            EXTRACT(
              EPOCH FROM (
                m.created_at
                - LAG(m.created_at) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at)
              )
            ) / 60 AS gap_minutes
          FROM messages m
          JOIN conversations c ON c.id = m.conversation_id
          LEFT JOIN contacts ct ON ct.id = c.contact_id
          WHERE m.created_at >= ${startDate}
            AND m.conversation_id IS NOT NULL
            ${tenantConversationFilter}
            ${userConversationFilter}
        ) gaps
        WHERE gap_minutes IS NOT NULL
          AND gap_minutes >= 0
          AND gap_minutes <= 24 * 60;
      `),
      prisma.$queryRaw<{ avg_hours: number | null }[]>(Prisma.sql`
        SELECT AVG(
          EXTRACT(
            EPOCH FROM (
              COALESCE(c.updated_at, c.last_message_at, c.created_at)
              - c.created_at
            )
          ) / 3600
        ) AS avg_hours
        FROM conversations c
        LEFT JOIN contacts ct ON ct.id = c.contact_id
        WHERE c.created_at >= ${startDate}
          AND c.last_message_at IS NOT NULL
          ${tenantConversationFilter}
          ${userConversationFilter};
      `),
    ]);

    const avgResponseTime = toNumber(responseRows[0]?.avg_minutes);
    const avgResolutionTime = toNumber(resolutionRows[0]?.avg_hours);

    const satisfactionActivities = await prisma.contact_activities.findMany({
      where: {
        created_at: { gte: startDate },
        ...(tenantId ? { contact: { tenant_id: tenantId } } : {}),
        ...(restrictToUser && userId
          ? {
              OR: [
                { user_id: userId },
                { contact: { user_id: userId } },
              ],
            }
          : {}),
      },
      select: { metadata: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });

    const satisfactionSamples = satisfactionActivities
      .map((activity) => {
        const metadata = activity.metadata as Record<string, unknown> | null;
        if (!metadata) return null;
        const rawValue =
          metadata.rating ?? metadata.score ?? metadata.satisfaction ?? metadata.csat;
        if (typeof rawValue === 'number') return rawValue;
        if (typeof rawValue === 'string') {
          const parsed = Number(rawValue);
          return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));

    const satisfactionRate =
      satisfactionSamples.length > 0
        ? clampPercentage(
            Math.round(
              (satisfactionSamples.reduce((sum, value) => sum + value, 0) /
                (satisfactionSamples.length * 5)) *
                1000,
            ) / 10,
          )
        : 0;

    res.json({
      performance: {
        avgResponseTime,
        avgResolutionTime,
        satisfactionRate,
        period,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching performance metrics');
    res.status(500).json({ error: 'Erro ao buscar performance' });
  }
}
