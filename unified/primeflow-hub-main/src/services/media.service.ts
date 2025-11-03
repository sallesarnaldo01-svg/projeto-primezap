/**
 * Media Service
 * Primeflow-Hub - Patch 4
 */

import { apiClient } from '@/lib/api-client';

const api = apiClient;

export type MediaQueryParams = Record<string, string | number | boolean | undefined>;

export interface MediaItem {
  id: string;
  filename?: string;
  originalName?: string;
  url: string;
  type: string;
  mimeType?: string;
  size?: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  thumbnailUrl?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface MediaPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface MediaListResponse {
  data: MediaItem[];
  pagination?: MediaPagination;
}

export const mediaService = {
  /**
   * Upload de arquivo único
   */
  async uploadSingle(file: File, tags: string[] = [], autoTag: boolean = true): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', JSON.stringify(tags));
    formData.append('autoTag', autoTag.toString());

    const response = await api.post<MediaItem>('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Upload de múltiplos arquivos
   */
  async uploadMultiple(files: File[], autoTag: boolean = true): Promise<{ data: MediaItem[] }> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('autoTag', autoTag.toString());

    const response = await api.post<MediaItem[]>('/media/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return { data: response.data };
  },

  /**
   * Listar mídia com filtros
   */
  async list(params?: MediaQueryParams): Promise<MediaListResponse> {
    const response = await api.get<MediaListResponse>('/media', { params });
    return response.data;
  },

  /**
   * Buscar mídia por ID
   */
  async getById(id: string): Promise<MediaItem> {
    const response = await api.get<MediaItem>(`/media/${id}`);
    return response.data;
  },

  /**
   * Atualizar tags de mídia
   */
  async updateTags(id: string, tags: string[]): Promise<MediaItem> {
    const response = await api.patch<MediaItem>(`/media/${id}/tags`, { tags });
    return response.data;
  },

  /**
   * Deletar mídia
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/media/${id}`);
  },

  /**
   * Buscar mídia por tags
   */
  async searchByTags(tags: string[], limit?: number): Promise<MediaItem[]> {
    const response = await api.post<MediaItem[]>('/media/search/by-tags', { tags, limit });
    return response.data;
  },

  /**
   * Obter todas as tags únicas
   */
  async getTags(): Promise<string[]> {
    const response = await api.get<string[]>('/media/tags');
    return response.data;
  },

  /**
   * Gerar tags automaticamente com IA
   */
  async autoTag(id: string): Promise<MediaItem> {
    const response = await api.post<MediaItem>(`/media/${id}/auto-tag`);
    return response.data;
  },
};
