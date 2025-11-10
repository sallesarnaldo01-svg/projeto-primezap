import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/services/api';

export interface Call {
  id: string;
  tenantId: string;
  contactId?: string;
  userId?: string;
  direction?: string;
  status?: string;
  duration?: number;
  phoneNumber?: string;
  recordingUrl?: string;
  notes?: string;
  callType?: string;
  startedAt?: string;
  endedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  contact?: {
    id: string;
    name: string;
    phone?: string;
    avatarUrl?: string;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface CallsResponse {
  data: Call[];
}

export const useCalls = (params?: {
  status?: string;
  direction?: string;
  contactId?: string;
  userId?: string;
}) => {
  return useQuery<CallsResponse>({
    queryKey: ['calls', params],
    queryFn: async () => {
      const response = await apiClient.get<CallsResponse>('/calls', { params });
      return response.data;
    },
  });
};

export const useCall = (id: string) => {
  return useQuery<Call>({
    queryKey: ['call', id],
    queryFn: async () => {
      const response = await apiClient.get<Call>(`/calls/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateCall = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: Partial<Call>) => {
      const response = await apiClient.post<Call>('/calls', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
};

export const useUpdateCall = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Call> }) => {
      const response = await apiClient.put<Call>(`/calls/${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
};

export const useDeleteCall = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/calls/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calls'] });
    },
  });
};
