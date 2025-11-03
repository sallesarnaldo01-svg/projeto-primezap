import { api } from './api';
import { apiClient } from '@/lib/api-client';

export interface Invoice {
  id: string;
  customer: string;
  value: number;
  status: 'paid' | 'pending' | 'overdue' | 'canceled';
  dueDate: string;
  paidAt?: string | null;
  description?: string;
  pdfUrl?: string;
  createdAt: string;
}

export interface CreateInvoiceData {
  customerId?: string;
  customer?: string;
  value: number;
  dueDate: string;
  description?: string;
}

export const invoicesService = {
  async list(params?: { status?: string; search?: string }): Promise<Invoice[]> {
    const res = await api.get<Invoice[]>('/invoices', params);
    return res.data;
  },

  async create(data: CreateInvoiceData): Promise<Invoice> {
    const res = await api.post<Invoice>('/invoices', data);
    return res.data;
  },

  async getPdf(id: string): Promise<Blob> {
    const res = await apiClient.get(`/invoices/${encodeURIComponent(id)}/pdf`, { responseType: 'blob' });
    return res.data as unknown as Blob;
  },

  async exportCsv(params?: { from?: string; to?: string }): Promise<Blob> {
    const res = await apiClient.get('/invoices/report', { params, responseType: 'blob' });
    return res.data as unknown as Blob;
  },
};

