/**
 * useMedia Hook
 * Primeflow-Hub - Patch 4
 */

import { useState, useCallback } from 'react';
import { mediaService } from '../services/media.service';

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

interface Media {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FetchMediaParams {
  type?: string;
  tags?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useMedia() {
  const [mediaList, setMediaList] = useState<Media[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [tags, setTags] = useState<string[]>([]);

  const fetchMedia = useCallback(async (params?: FetchMediaParams) => {
    setLoading(true);
    setError(null);
    try {
      const response = await mediaService.list(params);
      setMediaList(response.data);
      setPagination(response.pagination);
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao buscar mídia');
      setError(message);
      console.error('Erro ao buscar mídia:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTags = useCallback(async () => {
    try {
      const mediaTags = await mediaService.getTags();
      setTags(mediaTags);
    } catch (err) {
      console.error('Erro ao buscar tags:', err);
    }
  }, []);

  const uploadMedia = useCallback(async (files: File[], autoTag: boolean = true) => {
    setLoading(true);
    setError(null);
    try {
      let uploadedMedia: Media[];

      if (files.length === 1) {
        const media = await mediaService.uploadSingle(files[0], [], autoTag);
        uploadedMedia = [media];
      } else {
        const result = await mediaService.uploadMultiple(files, autoTag);
        uploadedMedia = result.data;
      }

      setMediaList((prev) => [...uploadedMedia, ...prev]);
      return uploadedMedia;
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao fazer upload');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTags = useCallback(async (id: string, tags: string[]) => {
    setLoading(true);
    setError(null);
    try {
      const updatedMedia = await mediaService.updateTags(id, tags);
      setMediaList((prev) =>
        prev.map((m) => (m.id === id ? updatedMedia : m))
      );
      return updatedMedia;
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao atualizar tags');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMedia = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await mediaService.delete(id);
      setMediaList((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao deletar mídia');
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
      const results = await mediaService.searchByTags(tags, limit);
      return results;
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao buscar mídia por tags');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const autoTag = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const updatedMedia = await mediaService.autoTag(id);
      setMediaList((prev) =>
        prev.map((m) => (m.id === id ? updatedMedia : m))
      );
      return updatedMedia;
    } catch (err) {
      const message = getErrorMessage(err, 'Erro ao gerar tags automaticamente');
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    mediaList,
    loading,
    error,
    pagination,
    tags,
    fetchMedia,
    fetchTags,
    uploadMedia,
    updateTags,
    deleteMedia,
    searchByTags,
    autoTag,
  };
}
