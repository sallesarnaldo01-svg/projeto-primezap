import { useQuery } from '@tanstack/react-query';
import {
  reportsService,
  type SalesReportResponse,
  type PerformanceReportResponse,
  type ConversationsReportResponse,
  type CampaignsReportResponse,
  type ReportFilters,
} from '@/services/reports';

const defaultSales: SalesReportResponse = {
  report: [],
  totals: { count: 0, value: 0, avgValue: 0 },
  period: { start: new Date().toISOString(), end: new Date().toISOString(), groupBy: 'month' },
};

const defaultPerformance: PerformanceReportResponse = {
  performance: [],
  period: { start: new Date().toISOString(), end: new Date().toISOString() },
};

const defaultConversations: ConversationsReportResponse = {
  byStatus: [],
  byPlatform: [],
  byDay: [],
  total: 0,
  period: { start: new Date().toISOString(), end: new Date().toISOString() },
};

const defaultCampaigns: CampaignsReportResponse = {
  campaigns: [],
  totals: {
    campaigns: 0,
    totalMessages: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalRead: 0,
    totalFailed: 0,
  },
  period: { start: new Date().toISOString(), end: new Date().toISOString() },
};

export function useReports(filters?: ReportFilters) {
  const salesQuery = useQuery({
    queryKey: ['reports', 'sales', filters],
    queryFn: () => reportsService.getSalesReport(filters),
    retry: 1,
  });

  const performanceQuery = useQuery({
    queryKey: ['reports', 'performance', filters],
    queryFn: () => reportsService.getPerformanceReport(filters),
    retry: 1,
  });

  const conversationsQuery = useQuery({
    queryKey: ['reports', 'conversations', filters],
    queryFn: () => reportsService.getConversationsReport(filters),
    retry: 1,
  });

  const campaignsQuery = useQuery({
    queryKey: ['reports', 'campaigns', filters],
    queryFn: () => reportsService.getCampaignsReport(filters),
    retry: 1,
  });

  return {
    sales: salesQuery.data ?? defaultSales,
    performance: performanceQuery.data ?? defaultPerformance,
    conversations: conversationsQuery.data ?? defaultConversations,
    campaigns: campaignsQuery.data ?? defaultCampaigns,
    isLoading:
      salesQuery.isLoading ||
      performanceQuery.isLoading ||
      conversationsQuery.isLoading ||
      campaignsQuery.isLoading,
    isFallback:
      salesQuery.isError ||
      performanceQuery.isError ||
      conversationsQuery.isError ||
      campaignsQuery.isError,
  };
}
