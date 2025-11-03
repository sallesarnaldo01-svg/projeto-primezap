import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  tagsService,
  type Tag,
  type TagsFilters,
  type CreateTagData,
  type UpdateTagData,
  type TagCategory,
} from '@/services/tags';
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

export interface UITag {
  id: string;
  name: string;
  color: string;
  description?: string;
  category: 'general' | 'customer' | 'product' | 'support' | 'sales' | 'marketing';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  usageCount: {
    contacts: number;
    companies: number;
    deals: number;
    tickets: number;
    conversations: number;
  };
  createdBy: string;
}

export const FALLBACK_TAGS: UITag[] = [
  {
    id: '1',
    name: 'VIP',
    color: '#FFD700',
    description: 'Clientes premium com alta prioridade',
    category: 'customer',
    isActive: true,
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2024-01-10'),
    usageCount: {
      contacts: 15,
      companies: 8,
      deals: 25,
      tickets: 12,
      conversations: 45,
    },
    createdBy: 'Admin',
  },
  {
    id: '2',
    name: 'Urgente',
    color: '#FF4444',
    description: 'Itens que precisam de atenção imediata',
    category: 'support',
    isActive: true,
    createdAt: new Date('2023-02-20'),
    updatedAt: new Date('2024-01-08'),
    usageCount: {
      contacts: 5,
      companies: 2,
      deals: 8,
      tickets: 35,
      conversations: 22,
    },
    createdBy: 'Support Team',
  },
  {
    id: '3',
    name: 'Enterprise',
    color: '#4A90E2',
    description: 'Empresas de grande porte',
    category: 'sales',
    isActive: true,
    createdAt: new Date('2023-03-10'),
    updatedAt: new Date('2024-01-05'),
    usageCount: {
      contacts: 12,
      companies: 20,
      deals: 18,
      tickets: 8,
      conversations: 30,
    },
    createdBy: 'Sales Team',
  },
  {
    id: '4',
    name: 'Bug',
    color: '#FF6B6B',
    description: 'Problemas técnicos reportados',
    category: 'support',
    isActive: true,
    createdAt: new Date('2023-04-05'),
    updatedAt: new Date('2024-01-12'),
    usageCount: {
      contacts: 0,
      companies: 0,
      deals: 0,
      tickets: 28,
      conversations: 15,
    },
    createdBy: 'Dev Team',
  },
  {
    id: '5',
    name: 'Hot Lead',
    color: '#FF8C00',
    description: 'Leads com alta probabilidade de conversão',
    category: 'marketing',
    isActive: true,
    createdAt: new Date('2023-05-15'),
    updatedAt: new Date('2024-01-01'),
    usageCount: {
      contacts: 32,
      companies: 15,
      deals: 40,
      tickets: 2,
      conversations: 28,
    },
    createdBy: 'Marketing Team',
  },
  {
    id: '6',
    name: 'Descontinuado',
    color: '#999999',
    description: 'Produtos ou serviços não mais oferecidos',
    category: 'product',
    isActive: false,
    createdAt: new Date('2023-06-01'),
    updatedAt: new Date('2023-12-20'),
    usageCount: {
      contacts: 0,
      companies: 0,
      deals: 5,
      tickets: 3,
      conversations: 1,
    },
    createdBy: 'Product Team',
  },
];

type SerializableFilterValue = string | number | boolean;

const serializeFilters = (filters?: TagsFilters) =>
  Object.entries(filters ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, SerializableFilterValue>>((acc, [key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        acc[key] = value;
      }
      return acc;
    }, {});

const mapTagFromApi = (tag: Tag): UITag => ({
  id: tag.id,
  name: tag.name,
  color: tag.color,
  description: tag.description ?? undefined,
  category: (tag.category as UITag['category']) ?? 'general',
  isActive: tag.isGlobal ?? true,
  createdAt: new Date(tag.createdAt),
  updatedAt: new Date(tag.updatedAt),
  usageCount: {
    contacts: tag.usageCount ?? 0,
    companies: 0,
    deals: 0,
    tickets: 0,
    conversations: 0,
  },
  createdBy: tag.createdBy,
});

export function useTags(filters?: TagsFilters) {
  const query = useQuery({
    queryKey: ['tags', serializeFilters(filters)],
    queryFn: () => tagsService.getTags(filters),
    retry: 1,
  });

  const usingFallback = query.isError;

  const tags = useMemo<UITag[]>(() => {
    if (query.data?.data && query.data.data.length > 0) {
      return query.data.data.map(mapTagFromApi);
    }
    if (usingFallback) {
      return FALLBACK_TAGS;
    }
    return [];
  }, [query.data, usingFallback]);

  return {
    tags,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFallback: usingFallback,
    refetch: query.refetch,
  };
}

export function useTagMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateTagData) => tagsService.createTag(data),
    onSuccess: () => {
      toast.success('Tag criada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar a tag.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTagData }) =>
      tagsService.updateTag(id, data),
    onSuccess: () => {
      toast.success('Tag atualizada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar a tag.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tagsService.deleteTag(id),
    onSuccess: () => {
      toast.success('Tag removida.');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível remover a tag.'));
    },
  });

  return {
    createTag: createMutation.mutateAsync,
    updateTag: updateMutation.mutateAsync,
    deleteTag: deleteMutation.mutateAsync,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  };
}
