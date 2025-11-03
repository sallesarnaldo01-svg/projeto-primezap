/**
 * useProducts Hook
 * Primeflow-Hub - Patch 4
 */

import { useState, useCallback } from 'react';
import { productsService, type Product, type ProductInput, type ProductListResponse } from '../services/products.service';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const maybeMessage = (error as { message?: string }).message;
    return maybeMessage ?? fallback;
  }

  return fallback;
};

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
      const response: ProductListResponse = await productsService.list(params);
      setProducts(response.data);
      setPagination(response.pagination ?? null);
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao buscar produtos');
      setError(message);
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

  const createProduct = useCallback(async (data: ProductInput) => {
    setLoading(true);
    setError(null);
    try {
      const newProduct = await productsService.create(data);
      setProducts((prev) => [newProduct, ...prev]);
      return newProduct;
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao criar produto');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProduct = useCallback(async (id: string, data: Partial<ProductInput>) => {
    setLoading(true);
    setError(null);
    try {
      const updatedProduct = await productsService.update(id, data);
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? updatedProduct : p))
      );
      return updatedProduct;
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao atualizar produto');
      setError(message);
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
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao deletar produto');
      setError(message);
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
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao buscar produtos por tags');
      setError(message);
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
      } catch (err) {
        const message = getErrorMessage(err, 'Erro ao atualizar estoque');
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const bulkImport = useCallback(async (payload: ProductInput[]) => {
    setLoading(true);
    setError(null);
    try {
      const result = await productsService.bulkImport(payload);
      await fetchProducts(); // Recarregar lista
      return result;
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao importar produtos');
      setError(message);
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
