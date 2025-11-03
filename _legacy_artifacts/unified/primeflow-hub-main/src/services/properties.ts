import { apiClient } from '@/lib/api-client';

export type Property = {
  id: string;
  title: string;
  type: 'house' | 'apartment' | 'commercial' | 'land' | 'farm';
  transactionType: 'sale' | 'rent' | 'both';
  status: 'available' | 'reserved' | 'sold' | 'rented' | 'unavailable';
  price?: number | null;
  rentPrice?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parkingSpaces?: number | null;
  area?: number | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  neighborhood?: string | null;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type PropertiesResponse = {
  data: Property[];
  pagination?: { total: number; page: number; limit: number; pages: number };
};

export const propertiesService = {
  async list(params?: Record<string, any>): Promise<PropertiesResponse> {
    const { data } = await apiClient.get('/properties', { params });
    return data;
  },
  async get(id: string): Promise<{ data: Property }> {
    const { data } = await apiClient.get(`/properties/${id}`);
    return data;
  },
  async create(payload: Partial<Property>): Promise<{ data: Property }> {
    const { data } = await apiClient.post('/properties', payload);
    return data;
  },
  async update(id: string, payload: Partial<Property>): Promise<{ data: Property }> {
    const { data } = await apiClient.put(`/properties/${id}`, payload);
    return data;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(`/properties/${id}`);
  },
  async generateDescription(id: string, tone: string = 'professional') {
    const { data } = await apiClient.post(`/properties/${id}/generate-description`, { tone });
    return data;
  }
};

