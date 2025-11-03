import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  usersService,
  type UserAccount,
  type CreateUserPayload,
  type UpdateUserPayload,
} from '@/services/users';
import { toast } from 'sonner';

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

export interface UIUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'manager' | 'agent' | 'viewer';
  department?: string;
  status: 'active' | 'inactive' | 'pending';
  lastLogin?: Date;
  avatar?: string;
  createdAt: Date;
}

export const FALLBACK_USERS: UIUser[] = [
  {
    id: '1',
    name: 'Carlos Admin',
    email: 'carlos@primezap.com',
    phone: '+55 11 99999-9999',
    role: 'admin',
    department: 'TI',
    status: 'active',
    lastLogin: new Date('2024-01-16T10:30:00'),
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'Maria Silva',
    email: 'maria@primezap.com',
    phone: '+55 11 88888-8888',
    role: 'manager',
    department: 'Vendas',
    status: 'active',
    lastLogin: new Date('2024-01-16T09:15:00'),
    avatar:
      'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face',
    createdAt: new Date('2024-01-02'),
  },
  {
    id: '3',
    name: 'João Santos',
    email: 'joao@primezap.com',
    phone: '+55 11 77777-7777',
    role: 'agent',
    department: 'Atendimento',
    status: 'active',
    lastLogin: new Date('2024-01-16T08:45:00'),
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face',
    createdAt: new Date('2024-01-03'),
  },
  {
    id: '4',
    name: 'Ana Costa',
    email: 'ana@primezap.com',
    phone: '+55 11 66666-6666',
    role: 'agent',
    department: 'Suporte',
    status: 'inactive',
    lastLogin: new Date('2024-01-15T16:20:00'),
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
    createdAt: new Date('2024-01-04'),
  },
  {
    id: '5',
    name: 'Pedro Lima',
    email: 'pedro@primezap.com',
    phone: '+55 11 55555-5555',
    role: 'viewer',
    department: 'Financeiro',
    status: 'active',
    lastLogin: new Date('2024-01-16T07:30:00'),
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=40&h=40&fit=crop&crop=face',
    createdAt: new Date('2024-01-05'),
  },
];

const mapUserFromApi = (user: UserAccount): UIUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: undefined,
  role: (user.role.toLowerCase() as UIUser['role']) ?? 'agent',
  department: undefined,
  status: user.isActive ? 'active' : 'inactive',
  lastLogin: user.lastLoginAt ? new Date(user.lastLoginAt) : undefined,
  avatar: user.avatar,
  createdAt: new Date(user.createdAt),
});

export function useUsers(filters?: { search?: string; role?: string; department?: string }) {
  const query = useQuery({
    queryKey: ['users', filters ?? {}],
    queryFn: () => usersService.listUsers(filters),
    retry: 1,
  });

  const usingFallback = query.isError;

  const users = useMemo<UIUser[]>(() => {
    if (query.data?.data && query.data.data.length > 0) {
      return query.data.data.map(mapUserFromApi);
    }
    if (usingFallback) {
      return FALLBACK_USERS;
    }
    return [];
  }, [query.data, usingFallback]);

  return {
    users,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFallback: usingFallback,
    refetch: query.refetch,
  };
}

export function useUserMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (payload: CreateUserPayload) => usersService.createUser(payload),
    onSuccess: () => {
      toast.success('Usuário criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar o usuário.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserPayload }) =>
      usersService.updateUser(id, data),
    onSuccess: () => {
      toast.success('Usuário atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o usuário.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersService.deleteUser(id),
    onSuccess: () => {
      toast.success('Usuário removido.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível remover o usuário.'));
    },
  });

  return {
    createUser: createMutation.mutateAsync,
    updateUser: updateMutation.mutateAsync,
    deleteUser: deleteMutation.mutateAsync,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  };
}
