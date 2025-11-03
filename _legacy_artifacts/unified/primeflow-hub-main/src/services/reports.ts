import { api } from './api';

export interface SalesReportItem {
  period: string;
  count: number;
  value: number;
  deals: Array<{
    id: string;
    title: string;
    value: number;
    assignedTo?: string | null;
  }>;
}

export interface SalesReportResponse {
  report: SalesReportItem[];
  totals: {
    count: number;
    value: number;
    avgValue: number;
  };
  period: {
    start: string;
    end: string;
    groupBy: string;
  };
}

export interface PerformanceReportItem {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string | null;
  };
  metrics: {
    conversations: number;
    tickets: number;
    deals: number;
    avgResponseTime: number;
  };
}

export interface PerformanceReportResponse {
  performance: PerformanceReportItem[];
  period: {
    start: string;
    end: string;
  };
}

export interface ConversationsReportResponse {
  byStatus: Array<{ status: string; _count: { id: number } }>;
  byPlatform: Array<{ platform: string; _count: { id: number } }>;
  byDay: Array<{ date: string; count: number }>;
  total: number;
  period: {
    start: string;
    end: string;
  };
}

export interface CampaignReportItem {
  id: string;
  name: string;
  status: string;
  totalMessages: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  deliveryRate: string;
  readRate: string;
  createdAt: string;
  completedAt?: string | null;
}

export interface CampaignsReportResponse {
  campaigns: CampaignReportItem[];
  totals: {
    campaigns: number;
    totalMessages: number;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
  };
  period: {
    start: string;
    end: string;
  };
}

export interface ReportFilters {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
  platform?: string;
}

export const reportsService = {
  async getSalesReport(filters?: ReportFilters): Promise<SalesReportResponse> {
    const response = await api.get<SalesReportResponse>('/reports/sales', filters);
    return response.data;
  },

  async getPerformanceReport(filters?: ReportFilters): Promise<PerformanceReportResponse> {
    const response = await api.get<PerformanceReportResponse>('/reports/performance', filters);
    return response.data;
  },

  async getConversationsReport(filters?: ReportFilters): Promise<ConversationsReportResponse> {
    const response = await api.get<ConversationsReportResponse>('/reports/conversations', filters);
    return response.data;
  },

  async getCampaignsReport(filters?: ReportFilters): Promise<CampaignsReportResponse> {
    const response = await api.get<CampaignsReportResponse>('/reports/campaigns', filters);
    return response.data;
  },
};
