import { apiClient } from '@/lib/api-client';

export type Visit = {
  id: string;
  tenantId: string;
  propertyId: string;
  dealId?: string | null;
  contactId?: string | null;
  brokerId: string;
  scheduledAt: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const visitsService = {
  async list(params?: Record<string, any>): Promise<{ data: Visit[] }> {
    const { data } = await apiClient.get('/visits', { params });
    return data;
  },
  async create(payload: Partial<Visit>): Promise<{ data: Visit }> {
    const { data } = await apiClient.post('/visits', payload);
    return data;
  },
  async update(id: string, payload: Partial<Visit>): Promise<{ data: Visit }> {
    const { data } = await apiClient.put(`/visits/${id}`, payload);
    return data;
  },
  async cancel(id: string): Promise<{ data: Visit }> {
    const { data } = await apiClient.patch(`/visits/${id}/cancel`);
    return data;
  }
};

