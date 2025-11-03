/**
 * Products Service
 * Primeflow-Hub - Patch 4
 */

import { apiClient } from '@/lib/api-client';

const api = apiClient;

export type ProductQueryParams = Record<string, string | number | boolean | undefined>;

export interface Product {
  id: string;
  name: string;
  price: number;
  sku?: string;
  stock: number;
  tags: string[];
  [key: string]: unknown;
}

export interface ProductPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ProductListResponse {
  data: Product[];
  pagination?: ProductPagination;
}

export interface ProductInput {
  name: string;
  price: number;
  sku?: string;
  stock?: number;
  tags?: string[];
  description?: string;
  metadata?: Record<string, unknown>;
  category?: string;
  [key: string]: unknown;
}

export const productsService = {
  /**
   * Listar produtos com filtros
   */
  async list(params?: ProductQueryParams): Promise<ProductListResponse> {
    const response = await api.get<ProductListResponse>('/products', { params });
    return response.data;
  },

  /**
   * Buscar produto por ID
   */
  async getById(id: string): Promise<Product> {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  },

  /**
   * Criar novo produto
   */
  async create(data: ProductInput): Promise<Product> {
    const response = await api.post<Product>('/products', data);
    return response.data;
  },

  /**
   * Atualizar produto
   */
  async update(id: string, data: Partial<ProductInput>): Promise<Product> {
    const response = await api.put<Product>(`/products/${id}`, data);
    return response.data;
  },

  /**
   * Deletar produto
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/products/${id}`);
  },

  /**
   * Buscar produtos por tags
   */
  async searchByTags(tags: string[], limit?: number): Promise<Product[]> {
    const response = await api.post<Product[]>('/products/search/by-tags', { tags, limit });
    return response.data;
  },

  /**
   * Obter categorias únicas
   */
  async getCategories(): Promise<string[]> {
    const response = await api.get<string[]>('/products/categories');
    return response.data;
  },

  /**
   * Obter tags únicas
   */
  async getTags(): Promise<string[]> {
    const response = await api.get<string[]>('/products/tags');
    return response.data;
  },

  /**
   * Atualizar estoque
   */
  async updateStock(id: string, stock: number, operation: 'set' | 'add' | 'subtract' = 'set'): Promise<Product> {
    const response = await api.patch<Product>(`/products/${id}/stock`, { stock, operation });
    return response.data;
  },

  /**
   * Importar produtos em massa
   */
  async bulkImport(products: ProductInput[]): Promise<{ imported: number; failed: number }> {
    const response = await api.post<{ imported: number; failed: number }>(
      '/products/bulk-import',
      { products }
    );
    return response.data;
  },
};
