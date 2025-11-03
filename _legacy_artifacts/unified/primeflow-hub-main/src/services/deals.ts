import { api } from './api';

export interface Deal {
  id: string;
  title: string;
  value: number;
  probability: number;
  stageId?: string;
  stage?: {
    id: string;
    name: string;
    color?: string;
  };
  contact?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  owner?: {
    id: string;
    name: string;
    email?: string;
  };
  expectedCloseDate?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface DealsFilters {
  stageId?: string;
  stage?: string;
  ownerId?: string;
  contactId?: string;
  minValue?: number;
  maxValue?: number;
  search?: string;
}

export interface DealHistoryEntry {
  id: string;
  dealId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
  createdAt: string | null;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export const dealsService = {
  async list(filters?: DealsFilters): Promise<Deal[]> {
    const params: Record<string, unknown> = { ...filters };
    if (filters?.minValue !== undefined) params.minValue = filters.minValue;
    if (filters?.maxValue !== undefined) params.maxValue = filters.maxValue;

    const response = await api.get<Deal[]>('/deals', params);
    return response.data;
  },

  async getDeals(filters?: DealsFilters): Promise<Deal[]> {
    return this.list(filters);
  },

  async getDeal(id: string): Promise<Deal> {
    const response = await api.get<Deal>(`/deals/${id}`);
    return response.data;
  },

  async createDeal(data: Partial<Deal> & { stageId?: string; stage?: string; contactId?: string; ownerId?: string }): Promise<Deal> {
    const response = await api.post<Deal>('/deals', data);
    return response.data;
  },

  async updateDeal(id: string, data: Partial<Deal> & { stageId?: string; stage?: string; contactId?: string; ownerId?: string }): Promise<Deal> {
    const response = await api.put<Deal>(`/deals/${id}`, data);
    return response.data;
  },

  async deleteDeal(id: string): Promise<void> {
    await api.delete(`/deals/${id}`);
  },

  async updateStage(id: string, stageId?: string, stage?: string): Promise<Deal> {
    const response = await api.patch<Deal>(`/deals/${id}/stage`, { stageId, stage });
    return response.data;
  },

  async moveStage(data: { dealId: string; stageId?: string; stage?: string }): Promise<Deal> {
    return this.updateStage(data.dealId, data.stageId, data.stage);
  },

  async getDealsByStage(): Promise<Record<string, Deal[]>> {
    const response = await api.get<Record<string, Deal[]>>('/deals/by-stage');
    return response.data;
  },

  async getStats(): Promise<{ total: number; totalValue: number; ganhos: number; ganhosValue: number; perdidos: number; taxaConversao: number }> {
    const response = await api.get('/deals/stats');
    return response.data;
  },

  async getHistory(id: string): Promise<DealHistoryEntry[]> {
    const response = await api.get<DealHistoryEntry[]>(`/deals/${id}/history`);
    return response.data;
  },

  async bulkAIAction(dealIds: string[], command: string): Promise<{ success: boolean; total: number; queued: number }> {
    const response = await api.post<{ success: boolean; total: number; queued: number }>(
      '/deals/bulk-ai',
      { dealIds, command },
    );
    return response.data;
  },
};
