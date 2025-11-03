import { api, PaginatedResponse, type Pagination } from './api';

export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER';

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsersListResponse {
  users: UserAccount[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: UserRole;
  avatar?: string;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  avatar?: string;
  isActive?: boolean;
}

export interface UserFilters {
  search?: string;
  role?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

const mapPagination = (pagination: UsersListResponse['pagination']): Pagination => ({
  page: pagination.page,
  limit: pagination.limit,
  total: pagination.total,
  totalPages: pagination.pages,
});

export const usersService = {
  async listUsers(filters?: UserFilters): Promise<PaginatedResponse<UserAccount>> {
    const response = await api.get<UsersListResponse>('/users', filters);
    return {
      data: response.data.users,
      pagination: mapPagination(response.data.pagination),
    };
  },

  async createUser(data: CreateUserPayload): Promise<UserAccount> {
    const response = await api.post<UserAccount>('/users', data);
    return response.data;
  },

  async updateUser(id: string, data: UpdateUserPayload): Promise<UserAccount> {
    const response = await api.put<UserAccount>(`/users/${id}`, data);
    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  },
};
