import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowsService } from '@/services/workflows';
import type { Workflow } from '@/types/workflow';
import { toast } from 'sonner';

const FALLBACK_WORKFLOWS: Workflow[] = [
  {
    id: 'fallback-1',
    name: 'Fluxo de Boas-vindas',
    description: 'Workflow padrão utilizado como fallback quando a API não está disponível.',
    status: 'draft',
    version: 1,
    nodes: [],
    edges: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function useWorkflows() {
  const queryClient = useQueryClient();

  const workflowsQuery = useQuery({
    queryKey: ['workflows'],
    queryFn: workflowsService.getWorkflows,
    retry: 1,
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => workflowsService.publishWorkflow(id),
    onSuccess: () => {
      toast.success('Workflow publicado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error ?? 'Não foi possível publicar o workflow.';
      toast.error(message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => workflowsService.duplicateWorkflow(id),
    onSuccess: () => {
      toast.success('Workflow duplicado com sucesso.');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error ?? 'Não foi possível duplicar o workflow.';
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowsService.deleteWorkflow(id),
    onSuccess: () => {
      toast.success('Workflow removido.');
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error ?? 'Não foi possível remover o workflow.';
      toast.error(message);
    },
  });

  const usingFallback = workflowsQuery.isError;

  const workflows: Workflow[] = useMemo(() => {
    if (workflowsQuery.data && workflowsQuery.data.length > 0) {
      return workflowsQuery.data;
    }
    if (usingFallback) {
      return FALLBACK_WORKFLOWS;
    }
    return workflowsQuery.data ?? [];
  }, [workflowsQuery.data, usingFallback]);

  return {
    workflows,
    isLoading: workflowsQuery.isLoading,
    isError: workflowsQuery.isError,
    usingFallback,
    refetch: workflowsQuery.refetch,
    publishWorkflow: (id: string) => publishMutation.mutateAsync(id),
    duplicateWorkflow: (id: string) => duplicateMutation.mutateAsync(id),
    deleteWorkflow: (id: string) => deleteMutation.mutateAsync(id),
    publishStatus: publishMutation.status,
    duplicateStatus: duplicateMutation.status,
    deleteStatus: deleteMutation.status,
  };
}
