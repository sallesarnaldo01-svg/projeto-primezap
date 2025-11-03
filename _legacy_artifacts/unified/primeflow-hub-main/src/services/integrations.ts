import { apiClient } from '@/lib/api-client';
import { Integration, IntegrationStatus } from '@/types/integrations';

export const integrationsService = {
  async getIntegrations(): Promise<Integration[]> {
    const response = await apiClient.get<Integration[]>('/integrations');
    return response.data;
  },

  async getIntegrationStatus(): Promise<IntegrationStatus[]> {
    const response = await apiClient.get<IntegrationStatus[]>('/integrations/status');
    return response.data;
  },

  async connectIntegration(provider: string, config: Record<string, unknown>): Promise<Integration> {
    const response = await apiClient.post<Integration>('/integrations', {
      provider,
      config,
    });
    return response.data;
  },

  async updateIntegration(id: string, config: Record<string, unknown>): Promise<Integration> {
    const response = await apiClient.put<Integration>(`/integrations/${id}`, config);
    return response.data;
  },

  async disconnectIntegration(id: string): Promise<void> {
    await apiClient.delete(`/integrations/${id}`);
  },

  async syncIntegration(id: string): Promise<void> {
    await apiClient.post<void>(`/integrations/${id}/sync`);
  },

  async testIntegration(id: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post<{ success: boolean; message: string }>(
      `/integrations/${id}/test`
    );
    return response.data;
  },
};
