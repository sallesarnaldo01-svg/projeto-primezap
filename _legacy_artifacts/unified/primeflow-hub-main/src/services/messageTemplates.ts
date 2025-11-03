import { apiClient } from '@/lib/api-client';

export type MessageTemplate = {
  id: string;
  tenantId: string;
  name: string;
  content: string;
  category?: string | null;
  variables?: string[] | null;
  shared?: boolean | null;
  createdById: string;
  createdAt?: string;
  updatedAt?: string;
};

export const messageTemplatesService = {
  async list(params?: { category?: string }): Promise<{ success: boolean; data: MessageTemplate[] }> {
    const { data } = await apiClient.get('/message-templates', { params });
    return data;
  },
  async get(id: string): Promise<{ success: boolean; data: MessageTemplate }> {
    const { data } = await apiClient.get(`/message-templates/${id}`);
    return data;
  },
  async create(payload: Partial<MessageTemplate>): Promise<{ success: boolean; data: MessageTemplate }> {
    const { data } = await apiClient.post('/message-templates', payload);
    return data;
  },
  async update(id: string, payload: Partial<MessageTemplate>): Promise<{ success: boolean; data: MessageTemplate }> {
    const { data } = await apiClient.put(`/message-templates/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<{ success: boolean; message: string }> {
    const { data } = await apiClient.delete(`/message-templates/${id}`);
    return data;
  }
};

