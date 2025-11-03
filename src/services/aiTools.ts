import { apiClient } from '@/lib/api-client';

export interface AITool {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  parameters: Record<string, unknown>;
  active: boolean;
}

export const aiToolsService = {
  async list(): Promise<AITool[]> {
    const { data } = await apiClient.get<AITool[]>('/ai/tools');
    return data;
  },
  async create(tool: Partial<AITool>): Promise<AITool> {
    const { data } = await apiClient.post<AITool>('/ai/tools', tool);
    return data;
  },
  async update(id: string, tool: Partial<AITool>): Promise<AITool> {
    const { data } = await apiClient.put<AITool>(`/ai/tools/${id}`, tool);
    return data;
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/ai/tools/${id}`);
  },
  async test(id: string, parameters: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data } = await apiClient.post<Record<string, unknown>>(
      `/ai/tools/${id}/test`,
      { parameters }
    );
    return data;
  }
};
