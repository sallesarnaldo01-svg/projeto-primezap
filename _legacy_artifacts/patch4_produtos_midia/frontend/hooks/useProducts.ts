/**
 * useProducts Hook
 * Primeflow-Hub - Patch 4
 */

import { useState, useCallback } from 'react';
import { productsService } from '../services/products.service';

interface Product {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  stock?: number;
  category?: string;
  tags: string[];
  images: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FetchProductsParams {
  query?: string;
  category?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);

  const fetchProducts = useCallback(async (params?: FetchProductsParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await productsService.list(params);
      setProducts(response.data);
      setPagination(response.pagination);
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar produtos');
      console.error('Erro ao buscar produtos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const cats = await productsService.getCategories();
      setCategories(cats);
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const productTags = await productsService.getTags();
      setTags(productTags);
    } catch (err) {
      console.error('Erro ao buscar tags:', err);
    }
  }, []);

  const createProduct = useCallback(async (data: Partial<Product>) => {
    setLoading(true);
    setError(null);
    try {
      const newProduct = await productsService.create(data);
      setProducts((prev) => [newProduct, ...prev]);
      return newProduct;
    } catch (err: any) {
      setError(err.message || 'Erro ao criar produto');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<Product>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedProduct = await productsService.update(id, data);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? updatedProduct : p))
      );
      return updatedProduct;
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar produto');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await productsService.delete(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err.message || 'Erro ao deletar produto');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const searchByTags = useCallback(async (tags: string[], limit?: number) => {
    setLoading(true);
    setError(null);
    try {
      const results = await productsService.searchByTags(tags, limit);
      return results;
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar produtos por tags');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStock = useCallback(
    async (id: string, stock: number, operation: 'set' | 'add' | 'subtract' = 'set') => {
      setLoading(true);
      setError(null);
      try {
        const updatedProduct = await productsService.updateStock(id, stock, operation);
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? updatedProduct : p))
        );
        return updatedProduct;
      } catch (err: any) {
        setError(err.message || 'Erro ao atualizar estoque');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const bulkImport = useCallback(async (products: Partial<Product>[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await productsService.bulkImport(products);
      await fetchProducts(); // Recarregar lista
      return result;
    } catch (err: any) {
      setError(err.message || 'Erro ao importar produtos');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    pagination,
    categories,
    tags,
    fetchProducts,
    fetchCategories,
    fetchTags,
    createProduct,
    updateProduct,
    deleteProduct,
    searchByTags,
    updateStock,
    bulkImport,
  };
}

