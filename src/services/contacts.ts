import { api, PaginatedResponse } from './api';

export interface ContactSummary {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  tags: string[];
  origem?: string;
  leadStatus?: string;
  lastInteractionAt?: string | null;
  customFields?: Record<string, unknown>;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    conversations: number;
    deals: number;
  };
}

export interface ContactDetails extends ContactSummary {
  conversations?: Array<{
    id: string;
    platform: string;
    status: string;
    lastMessageAt: string;
    createdAt: string;
  }>;
  deals?: Array<{
    id: string;
    title: string;
    value: number;
    stage: string;
    createdAt: string;
  }>;
  activities?: Array<{
    id: string;
    type: string;
    description?: string;
    metadata?: Record<string, unknown>;
    createdAt: string | null;
    user?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
}

export interface ContactFilters {
  search?: string;
  tag?: string;
  tags?: string[];
  origem?: string;
  leadStatus?: string;
  page?: number;
  limit?: number;
  order?: 'asc' | 'desc';
}

export interface ContactStats {
  total: number;
  leads: number;
  qualificados: number;
  convertidos: number;
  taxaQualificacao: number;
  taxaConversao: number;
}

export interface CreateContactInput {
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  tags?: string[];
  customFields?: Record<string, unknown>;
  notes?: string;
}

export interface UpdateContactInput extends Partial<CreateContactInput> {}

type ContactsApiResponse = {
  contacts: ContactSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};

export const contactsService = {
  async list(filters?: ContactFilters): Promise<PaginatedResponse<ContactSummary>> {
    const params: Record<string, unknown> = { ...filters };
    if (filters?.tags?.length) {
      params.tags = filters.tags.join(',');
    }

    const response = await api.get<ContactsApiResponse>('/contacts', params);
    return {
      data: response.data.contacts,
      pagination: {
        page: response.data.pagination.page,
        limit: response.data.pagination.limit,
        total: response.data.pagination.total,
        totalPages: response.data.pagination.pages,
      },
    };
  },

  async get(id: string): Promise<ContactDetails> {
    const response = await api.get<ContactDetails>(`/contacts/${id}`);
    return response.data;
  },

  async create(data: CreateContactInput): Promise<ContactDetails> {
    const response = await api.post<ContactDetails>('/contacts', data);
    return response.data;
  },

  async update(id: string, data: UpdateContactInput): Promise<ContactDetails> {
    const response = await api.put<ContactDetails>(`/contacts/${id}`, data);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/contacts/${id}`);
  },

  async addTags(id: string, tags: string[]): Promise<ContactDetails> {
    const response = await api.post<ContactDetails>(`/contacts/${id}/tags`, { tags });
    return response.data;
  },

  async removeTags(id: string, tags: string[]): Promise<ContactDetails> {
    const response = await api.delete<ContactDetails>(`/contacts/${id}/tags`, { tags });
    return response.data;
  },

  async getStats(): Promise<ContactStats> {
    const response = await api.get<ContactStats>('/contacts/stats');
    return response.data;
  },

  async getTimeline(id: string): Promise<ContactDetails['activities']> {
    const response = await api.get<ContactDetails['activities']>(`/contacts/${id}/timeline`);
    return response.data;
  },

  async importCSV(file: File): Promise<{ success: boolean; imported: number; failed: number; total: number; errors?: Array<{ row: Record<string, string>; reason: string }> }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<{ success: boolean; imported: number; failed: number; total: number; errors?: Array<{ row: Record<string, string>; reason: string }> }>(
      '/contacts/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      },
    );

    return response.data;
  },
};
