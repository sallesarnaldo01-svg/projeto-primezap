import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

export interface Commission {
  id: string;
  tenantId: string;
  dealId?: string;
  userId?: string;
  brokerName?: string;
  dealTitle?: string;
  amount: number;
  percentage?: number;
  status?: string;
  paymentDate?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  deal?: {
    id: string;
    title: string;
    value?: number;
  };
}

export interface CommissionsResponse {
  data: Commission[];
}

export const useCommissions = (params?: {
  status?: string;
  userId?: string;
  dealId?: string;
}) => {
  return useQuery<CommissionsResponse>({
    queryKey: ['commissions', params],
    queryFn: async () => {
      const response = await apiClient.get<CommissionsResponse>('/commissions', { params });
      return response.data;
    },
  });
};

export const useCommission = (id: string) => {
  return useQuery<Commission>({
    queryKey: ['commission', id],
    queryFn: async () => {
      const response = await apiClient.get<Commission>(`/commissions/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateCommission = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Commission>) => {
      const response = await apiClient.post<Commission>('/commissions', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
  });
};

export const useUpdateCommission = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Commission> }) => {
      const response = await apiClient.put<Commission>(`/commissions/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
  });
};

export const useDeleteCommission = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/commissions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commissions'] });
    },
  });
};
