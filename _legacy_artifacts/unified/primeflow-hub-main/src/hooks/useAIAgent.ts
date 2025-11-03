import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  aiAgentsService,
  type AIAgent,
  type CreateAIAgentPayload,
  type UpdateAIAgentPayload,
} from '@/services/aiAgents';

const resolveErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      response?: { data?: { error?: string; message?: string } };
      message?: string;
    };

    return (
      maybeError.response?.data?.error ??
      maybeError.response?.data?.message ??
      maybeError.message ??
      fallback
    );
  }

  return fallback;
};

const FALLBACK_AGENT: AIAgent = {
  id: 'fallback-agent',
  name: 'Agente IA Padrão',
  description: 'Agente local para demonstração enquanto a API não está disponível.',
  provider: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  topP: 0.9,
  systemPrompt:
    'Você é um assistente virtual especializado em automação de atendimento e CRM.\n' +
    'Ofereça respostas objetivas, com tom profissional e cordial.\n' +
    'Sempre forneça próximos passos e destaque oportunidades de automação.',
  instructions:
    'Reforce a marca PrimeZapAI nas interações.\n' +
    'Escale tickets críticos automaticamente.\n' +
    'Use emojis apenas quando fizer sentido para humanizar a conversa.',
  tags: ['demo', 'fallback'],
  status: 'active',
  updatedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

export interface UseAIAgentFilters {
  q?: string;
  status?: 'active' | 'inactive' | 'draft';
}

export function useAIAgent(filters?: UseAIAgentFilters) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ai-agents'],
    queryFn: () => aiAgentsService.list(),
    retry: 1,
  });

  const createAgentMutation = useMutation({
    mutationFn: (payload: CreateAIAgentPayload) => aiAgentsService.create(payload),
    onSuccess: (agent) => {
      toast.success('Agente criado com sucesso!');
      queryClient.setQueryData<AIAgent[]>(['ai-agents'], (previous) =>
        previous ? [agent, ...previous] : [agent],
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(
        resolveErrorMessage(
          error,
          'Não foi possível criar o agente. Tente novamente mais tarde.',
        ),
      );
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAIAgentPayload }) =>
      aiAgentsService.update(id, data),
    onSuccess: (agent) => {
      toast.success('Agente atualizado com sucesso!');
      queryClient.setQueryData<AIAgent[]>(['ai-agents'], (previous) =>
        previous?.map((item) => (item.id === agent.id ? agent : item)) ?? [agent],
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(
        resolveErrorMessage(
          error,
          'Não foi possível atualizar o agente. Tente novamente mais tarde.',
        ),
      );
    },
  });

  const deleteAgentMutation = useMutation({
    mutationFn: (id: string) => aiAgentsService.remove(id),
    onSuccess: (_, id) => {
      toast.success('Agente removido.');
      queryClient.setQueryData<AIAgent[]>(['ai-agents'], (previous) =>
        previous?.filter((agent) => agent.id !== id) ?? [],
      );
    },
    onError: (error) => {
      console.error(error);
      toast.error(
        resolveErrorMessage(
          error,
          'Não foi possível remover o agente. Tente novamente mais tarde.',
        ),
      );
    },
  });

  const usingFallback = query.isError;

  const agents = useMemo(() => {
    if (usingFallback) {
      if (filters?.status && filters.status !== 'active') {
        return [];
      }
      if (filters?.q) {
        const normalized = filters.q.toLowerCase();
        const matches =
          FALLBACK_AGENT.name.toLowerCase().includes(normalized) ||
          (FALLBACK_AGENT.description ?? '').toLowerCase().includes(normalized);
        return matches ? [FALLBACK_AGENT] : [];
      }
      return [FALLBACK_AGENT];
    }

    const fetched = query.data ?? [];
    if (!filters) return fetched;

    return fetched.filter((agent) => {
      const matchesStatus = filters.status ? agent.status === filters.status : true;
      const matchesQuery = filters.q
        ? [agent.name, agent.description, agent.model, agent.provider]
            .filter(Boolean)
            .some((field) => field!.toLowerCase().includes(filters.q!.toLowerCase()))
        : true;
      return matchesStatus && matchesQuery;
    });
  }, [query.data, usingFallback, filters]);

  return {
    agents,
    isLoading: query.isLoading,
    isFallback: usingFallback,
    refetch: query.refetch,
    createAgent: createAgentMutation.mutateAsync,
    updateAgent: updateAgentMutation.mutateAsync,
    deleteAgent: deleteAgentMutation.mutateAsync,
    creating: createAgentMutation.isLoading,
    updating: updateAgentMutation.isLoading,
    deleting: deleteAgentMutation.isLoading,
  };
}
