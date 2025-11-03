import { api } from './api';

export interface LeadInteraction {
  id: string;
  leadId: string;
  type: 'CALL' | 'EMAIL' | 'SMS' | 'WHATSAPP' | 'VISIT' | 'NOTE' | 'TASK';
  content?: string;
  createdAt: string;
  userId?: string;
}

export const leadInteractionsService = {
  async list(leadId: string): Promise<LeadInteraction[]> {
    const res = await api.get<LeadInteraction[]>(`/api/lead-interactions`, { leadId });
    return res.data;
  },
  async add(payload: Omit<LeadInteraction, 'id' | 'createdAt'>): Promise<LeadInteraction> {
    const res = await api.post<LeadInteraction>(`/api/lead-interactions`, payload);
    return res.data;
  },
};

