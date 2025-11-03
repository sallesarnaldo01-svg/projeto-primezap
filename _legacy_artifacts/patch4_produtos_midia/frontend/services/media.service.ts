/**
 * Media Service
 * Primeflow-Hub - Patch 4
 */

import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar token de autenticação
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const mediaService = {
  /**
   * Upload de arquivo único
   */
  async uploadSingle(file: File, tags: string[] = [], autoTag: boolean = true) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', JSON.stringify(tags));
    formData.append('autoTag', autoTag.toString());

    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Upload de múltiplos arquivos
   */
  async uploadMultiple(files: File[], autoTag: boolean = true) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });
    formData.append('autoTag', autoTag.toString());

    const response = await api.post('/media/upload-multiple', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Listar mídia com filtros
   */
  async list(params?: any) {
    const response = await api.get('/media', { params });
    return response.data;
  },

  /**
   * Buscar mídia por ID
   */
  async getById(id: string) {
    const response = await api.get(`/media/${id}`);
    return response.data;
  },

  /**
   * Atualizar tags de mídia
   */
  async updateTags(id: string, tags: string[]) {
    const response = await api.patch(`/media/${id}/tags`, { tags });
    return response.data;
  },

  /**
   * Deletar mídia
   */
  async delete(id: string) {
    await api.delete(`/media/${id}`);
  },

  /**
   * Buscar mídia por tags
   */
  async searchByTags(tags: string[], limit?: number) {
    const response = await api.post('/media/search/by-tags', { tags, limit });
    return response.data;
  },

  /**
   * Obter todas as tags únicas
   */
  async getTags() {
    const response = await api.get('/media/tags');
    return response.data;
  },

  /**
   * Gerar tags automaticamente com IA
   */
  async autoTag(id: string) {
    const response = await api.post(`/media/${id}/auto-tag`);
    return response.data;
  },
};

