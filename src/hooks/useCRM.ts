import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  crmService,
  type CreateDealInput,
  type DealFilters,
  type DealStage,
  type UpdateDealInput,
} from '@/services/crm';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      response?: { data?: { error?: string } };
      message?: string;
    };

    return maybeError.response?.data?.error ?? maybeError.message ?? fallback;
  }

  return fallback;
};

export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: ['deals', filters],
    queryFn: () => crmService.getDeals(filters),
  });
}

export function usePipeline() {
  return useQuery({
    queryKey: ['pipeline'],
    queryFn: () => crmService.getPipeline(),
    refetchInterval: 30_000,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateDealInput) => crmService.createDeal(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      toast.success('Deal criado com sucesso!');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao criar deal.');
      toast.error(message);
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDealInput }) =>
      crmService.updateDeal(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      toast.success('Deal atualizado com sucesso!');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao atualizar deal.');
      toast.error(message);
    },
  });
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: DealStage }) =>
      crmService.updateDealStage(id, stage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      toast.success('Deal movido com sucesso!');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao mover deal.');
      toast.error(message);
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => crmService.deleteDeal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deals'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
      toast.success('Deal removido.');
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Erro ao remover deal.');
      toast.error(message);
    },
  });
}
