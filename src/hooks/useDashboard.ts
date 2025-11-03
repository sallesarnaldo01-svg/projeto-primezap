import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboard';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'metrics'],
    queryFn: () => dashboardService.getMetrics(),
    refetchInterval: 30_000,
  });
}

export function useDashboardFunnel() {
  return useQuery({
    queryKey: ['dashboard', 'funnel'],
    queryFn: () => dashboardService.getFunnel(),
    refetchInterval: 60_000,
  });
}

export function useDashboardTicketsByStatus() {
  return useQuery({
    queryKey: ['dashboard', 'tickets-by-status'],
    queryFn: () => dashboardService.getTicketsByStatus(),
    refetchInterval: 30_000,
  });
}

export function useDashboardRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['dashboard', 'recent-activity', limit],
    queryFn: () => dashboardService.getRecentActivity(limit),
    refetchInterval: 15_000,
  });
}

export function useDashboardPerformance(period: 'day' | 'week' | 'month' = 'week') {
  return useQuery({
    queryKey: ['dashboard', 'performance', period],
    queryFn: () => dashboardService.getPerformance(period),
    refetchInterval: 60_000,
  });
}
