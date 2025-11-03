import { api } from './api';

export interface DashboardMetrics {
  conversations: {
    total: number;
    active: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    growthRate: number;
  };
  contacts: {
    total: number;
  };
  campaigns: {
    total: number;
    active: number;
  };
}

export interface FunnelStage {
  stage: string;
  count: number;
  value: number;
}

export interface TicketsByStatus {
  status: string;
  count: number;
}

export interface ActivityItem {
  id: string;
  type: string;
  description: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface PerformanceMetrics {
  avgResponseTime: number;
  avgResolutionTime: number;
  satisfactionRate: number;
  period: string;
}

export const dashboardService = {
  async getMetrics(): Promise<DashboardMetrics> {
    const response = await api.get<{ metrics: DashboardMetrics }>('/dashboard/metrics');
    return response.data.metrics;
  },

  async getFunnel(): Promise<{ funnel: FunnelStage[]; conversionRate: number }> {
    const response = await api.get<{ funnel: FunnelStage[]; conversionRate: number }>(
      '/dashboard/funnel',
    );
    return response.data;
  },

  async getTicketsByStatus(): Promise<TicketsByStatus[]> {
    const response = await api.get<{ tickets: TicketsByStatus[] }>('/dashboard/tickets-by-status');
    return response.data.tickets;
  },

  async getRecentActivity(limit = 10): Promise<ActivityItem[]> {
    const response = await api.get<{ activities: ActivityItem[] }>(
      '/dashboard/recent-activity',
      { limit },
    );
    return response.data.activities;
  },

  async getPerformance(period: 'day' | 'week' | 'month' = 'week'): Promise<PerformanceMetrics> {
    const response = await api.get<{ performance: PerformanceMetrics }>(
      '/dashboard/performance',
      { period },
    );
    return response.data.performance;
  },
};
