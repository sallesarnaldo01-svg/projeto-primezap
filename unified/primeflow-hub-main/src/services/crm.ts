import { api, PaginatedResponse } from './api';

export type DealStage =
  | 'LEAD'
  | 'QUALIFIED'
  | 'PROPOSAL'
  | 'NEGOTIATION'
  | 'CLOSED_WON'
  | 'CLOSED_LOST';

export interface DealContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
}

export interface DealAssignee {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Deal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  expectedCloseDate?: string | null;
  closedAt?: string | null;
  notes?: string | null;
  contactId: string;
  contact?: DealContact;
  assignedToId?: string | null;
  assignedTo?: DealAssignee | null;
  createdAt: string;
  updatedAt: string;
}

export interface DealFilters {
  stage?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateDealInput {
  title: string;
  contactId: string;
  value?: number;
  stage?: DealStage;
  expectedCloseDate?: string;
  notes?: string;
}

export interface UpdateDealInput extends Partial<CreateDealInput> {
  assignedToId?: string;
}

export type Pipeline = Record<DealStage, Deal[]>;

type DealsApiResponse = {
  deals: Deal[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export const crmService = {
  async getDeals(filters?: DealFilters): Promise<PaginatedResponse<Deal>> {
    const response = await api.get<DealsApiResponse>('/crm/deals', filters);
    return {
      data: response.data.deals,
      pagination: {
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.pages,
      },
    };
  },

  async createDeal(data: CreateDealInput): Promise<Deal> {
    const response = await api.post<Deal>('/crm/deals', data);
    return response.data;
  },

  async updateDeal(id: string, data: UpdateDealInput): Promise<Deal> {
    const response = await api.put<Deal>(`/crm/deals/${id}`, data);
    return response.data;
  },

  async updateDealStage(id: string, stage: DealStage): Promise<Deal> {
    const response = await api.put<Deal>(`/crm/deals/${id}/stage`, { stage });
    return response.data;
  },

  async deleteDeal(id: string): Promise<void> {
    await api.delete(`/crm/deals/${id}`);
  },

  async getPipeline(): Promise<Pipeline> {
    const response = await api.get<Pipeline>('/crm/pipeline');
    return response.data;
  },
};
