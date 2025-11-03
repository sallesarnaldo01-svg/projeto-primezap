import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ticketsService,
  type Ticket,
  type TicketMetrics,
  type TicketsFilters,
  type CreateTicketData,
  type UpdateTicketData,
} from '@/services/tickets';
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

export interface UITicketMessage {
  id: string;
  content: string;
  author: string;
  timestamp: Date;
  type: 'message' | 'note' | 'system';
}

export interface UITicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  customer: {
    name: string;
    email?: string;
    avatar?: string;
  };
  assignee?: {
    name: string;
    avatar?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  slaDeadline?: Date;
  tags: string[];
  messages: UITicketMessage[];
}

export const FALLBACK_TICKETS: UITicket[] = [
  {
    id: 'T-001',
    title: 'Problema no login do sistema',
    description: 'Usuário não consegue fazer login na plataforma após a última atualização.',
    status: 'open',
    priority: 'high',
    category: 'Técnico',
    customer: {
      name: 'João Silva',
      email: 'joao@empresa.com',
      avatar: '/avatars/01.png',
    },
    assignee: {
      name: 'Ana Costa',
      avatar: '/avatars/02.png',
    },
    createdAt: new Date('2024-01-15T10:30:00'),
    updatedAt: new Date('2024-01-15T14:20:00'),
    slaDeadline: new Date('2024-01-16T10:30:00'),
    tags: ['login', 'urgente', 'bug'],
    messages: [
      {
        id: '1',
        content: 'Usuário reportou erro 500 ao tentar fazer login.',
        author: 'João Silva',
        timestamp: new Date('2024-01-15T10:30:00'),
        type: 'message',
      },
      {
        id: '2',
        content: 'Investigando logs do servidor. Possível problema na autenticação.',
        author: 'Ana Costa',
        timestamp: new Date('2024-01-15T11:15:00'),
        type: 'note',
      },
    ],
  },
  {
    id: 'T-002',
    title: 'Solicitação de nova funcionalidade',
    description: 'Cliente solicita implementação de relatórios personalizados.',
    status: 'in_progress',
    priority: 'medium',
    category: 'Funcionalidade',
    customer: {
      name: 'Maria Santos',
      email: 'maria@cliente.com',
    },
    assignee: {
      name: 'Pedro Lima',
      avatar: '/avatars/03.png',
    },
    createdAt: new Date('2024-01-14T09:00:00'),
    updatedAt: new Date('2024-01-15T16:45:00'),
    slaDeadline: new Date('2024-01-20T09:00:00'),
    tags: ['funcionalidade', 'relatórios'],
    messages: [
      {
        id: '1',
        content: 'Gostaríamos de ter relatórios mais detalhados no dashboard.',
        author: 'Maria Santos',
        timestamp: new Date('2024-01-14T09:00:00'),
        type: 'message',
      },
      {
        id: '2',
        content: 'Analisando requisitos técnicos. Prazo estimado: 1 semana.',
        author: 'Pedro Lima',
        timestamp: new Date('2024-01-14T10:30:00'),
        type: 'note',
      },
    ],
  },
];

export const FALLBACK_METRICS: TicketMetrics = {
  total: 245,
  open: 45,
  pending: 32,
  resolved: 128,
  closed: 40,
  avgFirstResponse: 1.8,
  avgResolution: 4.2,
  slaCompliance: 94.5,
};

type SerializableFilterValue = string | number | boolean;

const serializeFilters = (filters?: TicketsFilters) =>
  Object.entries(filters ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, SerializableFilterValue>>((acc, [key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        acc[key] = value;
      }
      return acc;
    }, {});

const mapTicketFromApi = (ticket: Ticket): UITicket => {
  const messages: UITicketMessage[] =
    ticket.activities?.map((activity) => ({
      id: activity.id,
      content: activity.content,
      author: activity.user?.name ?? 'Sistema',
      timestamp: new Date(activity.createdAt),
      type:
        activity.type === 'comment'
          ? 'message'
          : activity.type === 'status_change'
          ? 'system'
          : 'note',
    })) ?? [];

  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status:
      ticket.status === 'pending'
        ? 'in_progress'
        : (ticket.status as UITicket['status']),
    priority: ticket.priority,
    category: ticket.category,
    customer: {
      name: ticket.contact?.name ?? 'Contato',
      email: ticket.contact?.email,
      avatar: ticket.contact?.avatar,
    },
    assignee: ticket.assignee
      ? {
          name: ticket.assignee.name,
          avatar: ticket.assignee.avatar,
        }
      : undefined,
    createdAt: new Date(ticket.createdAt),
    updatedAt: new Date(ticket.updatedAt),
    slaDeadline: ticket.slaDeadline ? new Date(ticket.slaDeadline) : undefined,
    tags: ticket.tags ?? [],
    messages,
  };
};

export function useTickets(filters?: TicketsFilters) {
  const ticketsQuery = useQuery({
    queryKey: ['tickets', serializeFilters(filters)],
    queryFn: () => ticketsService.getTickets(filters),
    retry: 1,
  });

  const metricsQuery = useQuery({
    queryKey: ['tickets-metrics'],
    queryFn: () => ticketsService.getMetrics(),
    retry: 1,
  });

  const usingFallback = ticketsQuery.isError;

  const tickets = useMemo<UITicket[]>(() => {
    if (ticketsQuery.data?.data && ticketsQuery.data.data.length > 0) {
      return ticketsQuery.data.data.map(mapTicketFromApi);
    }
    if (usingFallback) {
      return FALLBACK_TICKETS;
    }
    return [];
  }, [ticketsQuery.data, usingFallback]);

  const metrics =
    metricsQuery.data && !metricsQuery.isError
      ? metricsQuery.data
      : FALLBACK_METRICS;

  return {
    tickets,
    metrics,
    pagination: ticketsQuery.data?.pagination,
    isLoading: ticketsQuery.isLoading || metricsQuery.isLoading,
    isFallback: usingFallback,
    refetch: ticketsQuery.refetch,
  };
}

export function useTicketMutations() {
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (data: CreateTicketData) => ticketsService.createTicket(data),
    onSuccess: () => {
      toast.success('Ticket criado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-metrics'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível criar o ticket.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketData }) =>
      ticketsService.updateTicket(id, data),
    onSuccess: () => {
      toast.success('Ticket atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível atualizar o ticket.'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ticketsService.deleteTicket(id),
    onSuccess: () => {
      toast.success('Ticket removido.');
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-metrics'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Não foi possível remover o ticket.'));
    },
  });

  return {
    createTicket: createMutation.mutateAsync,
    updateTicket: updateMutation.mutateAsync,
    deleteTicket: deleteMutation.mutateAsync,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
  };
}
