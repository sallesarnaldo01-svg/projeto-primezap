import type { AxiosRequestConfig } from 'axios';
import { apiClient } from '@/lib/api-client';

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

const wrapResponse = <T>(data: T): ApiResponse<T> => ({
  data,
  success: true,
});

export const api = {
  async get<T, TParams extends Record<string, unknown> | undefined = undefined>(
    endpoint: string,
    params?: TParams,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.get<T>(endpoint, { params, ...(config ?? {}) });
    return wrapResponse(response.data);
  },

  async post<T, TBody = unknown>(
    endpoint: string,
    data?: TBody,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.post<T>(endpoint, data, config);
    return wrapResponse(response.data);
  },

  async put<T, TBody = unknown>(
    endpoint: string,
    data?: TBody,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.put<T>(endpoint, data, config);
    return wrapResponse(response.data);
  },

  async patch<T, TBody = unknown>(
    endpoint: string,
    data?: TBody,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.patch<T>(endpoint, data, config);
    return wrapResponse(response.data);
  },

  async delete<T, TBody = unknown>(
    endpoint: string,
    data?: TBody,
    config?: AxiosRequestConfig,
  ): Promise<ApiResponse<T>> {
    const response = await apiClient.delete<T>(endpoint, { data, ...(config ?? {}) });
    return wrapResponse(response.data);
  },
};
