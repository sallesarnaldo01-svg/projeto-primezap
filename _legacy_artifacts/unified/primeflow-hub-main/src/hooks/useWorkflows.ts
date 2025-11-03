import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowsService } from '@/services/workflows';
import type { Workflow } from '@/types/workflow';

export function useWorkflows() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowsService.getWorkflows(),
    retry: 1,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => workflowsService.publishWorkflow(id),
    onSuccess: (workflow) => {
      queryClient.setQueryData<Workflow[]>(['workflows'], (existing) => {
        if (!existing) return existing;
        return existing.map((item) => (item.id === workflow.id ? workflow : item));
      });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => workflowsService.duplicateWorkflow(id),
    onSuccess: (workflow) => {
      queryClient.setQueryData<Workflow[]>(['workflows'], (existing) => {
        if (!existing) {
          return [workflow];
        }
        return [...existing, workflow];
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsService.deleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });

  return {
    workflows: listQuery.data ?? [],
    pagination: listQuery.data
      ? {
          page: 1,
          limit: listQuery.data.length,
          total: listQuery.data.length,
          totalPages: 1,
        }
      : undefined,
    isLoading: listQuery.isLoading,
    usingFallback: listQuery.isError,
    refetch: listQuery.refetch,
    publishWorkflow: publishMutation.mutateAsync,
    duplicateWorkflow: duplicateMutation.mutateAsync,
    deleteWorkflow: deleteMutation.mutateAsync,
  };
}
