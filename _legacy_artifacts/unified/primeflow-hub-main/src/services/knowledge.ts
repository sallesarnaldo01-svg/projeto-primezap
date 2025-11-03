import { apiClient } from '@/lib/api-client';

export type KnowledgeDocument = Record<string, unknown>;

export const knowledgeService = {
  async list(agentId?: string): Promise<KnowledgeDocument[]> {
    const { data } = await apiClient.get<KnowledgeDocument[]>(
      `/ai/knowledge${agentId ? `?agentId=${agentId}` : ''}`
    );
    return data;
  },
  async create(doc: KnowledgeDocument): Promise<KnowledgeDocument> {
    const { data } = await apiClient.post<KnowledgeDocument>('/ai/knowledge', doc);
    return data;
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/ai/knowledge/${id}`);
  },
  async search(query: string, agentId?: string): Promise<KnowledgeDocument[]> {
    const { data } = await apiClient.post<KnowledgeDocument[]>(
      '/ai/knowledge/search',
      { query, agentId }
    );
    return data;
  }
};
