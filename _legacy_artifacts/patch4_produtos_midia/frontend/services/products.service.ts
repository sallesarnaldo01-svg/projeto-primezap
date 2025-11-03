/**
 * Products Service
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

export const productsService = {
  /**
   * Listar produtos com filtros
   */
  async list(params?: any) {
    const response = await api.get('/products', { params });
    return response.data;
  },

  /**
   * Buscar produto por ID
   */
  async getById(id: string) {
    const response = await api.get(`/products/${id}`);
    return response.data;
  },

  /**
   * Criar novo produto
   */
  async create(data: any) {
    const response = await api.post('/products', data);
    return response.data;
  },

  /**
   * Atualizar produto
   */
  async update(id: string, data: any) {
    const response = await api.put(`/products/${id}`, data);
    return response.data;
  },

  /**
   * Deletar produto
   */
  async delete(id: string) {
    await api.delete(`/products/${id}`);
  },

  /**
   * Buscar produtos por tags
   */
  async searchByTags(tags: string[], limit?: number) {
    const response = await api.post('/products/search/by-tags', { tags, limit });
    return response.data;
  },

  /**
   * Obter categorias únicas
   */
  async getCategories() {
    const response = await api.get('/products/categories');
    return response.data;
  },

  /**
   * Obter tags únicas
   */
  async getTags() {
    const response = await api.get('/products/tags');
    return response.data;
  },

  /**
   * Atualizar estoque
   */
  async updateStock(id: string, stock: number, operation: 'set' | 'add' | 'subtract' = 'set') {
    const response = await api.patch(`/products/${id}/stock`, { stock, operation });
    return response.data;
  },

  /**
   * Importar produtos em massa
   */
  async bulkImport(products: any[]) {
    const response = await api.post('/products/bulk-import', { products });
    return response.data;
  },
};

