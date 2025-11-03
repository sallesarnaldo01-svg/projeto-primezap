import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  conversasService,
  type Conversation,
  type ConversationsFilters,
  type Message,
  type SendMessageData,
} from '@/services/conversas';
import { toast } from 'sonner';

const now = () => new Date().toISOString();

export const FALLBACK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    contactId: 'contact-1',
    channel: 'whatsapp',
    status: 'closed',
    assignedTo: 'user-1',
    lastMessageAt: new Date('2024-01-16T17:35:00').toISOString(),
    unreadCount: 0,
    tags: ['VIP'],
    priority: 'high',
    slaDeadline: new Date('2024-01-17T12:00:00').toISOString(),
    createdAt: new Date('2024-01-15T10:10:00').toISOString(),
    updatedAt: new Date('2024-01-16T17:35:00').toISOString(),
    contact: {
      id: 'contact-1',
      name: 'Maria Santos',
      phone: '+55 11 99999-9999',
      email: 'maria@example.com',
      avatar:
        'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=40&h=40&fit=crop&crop=face',
      tags: ['VIP'],
    },
  },
  {
    id: 'conv-2',
    contactId: 'contact-2',
    channel: 'instagram',
    status: 'pending',
    assignedTo: 'user-2',
    lastMessageAt: new Date('2024-01-16T17:20:00').toISOString(),
    unreadCount: 3,
    tags: ['Suporte'],
    priority: 'medium',
    createdAt: new Date('2024-01-15T14:00:00').toISOString(),
    updatedAt: new Date('2024-01-16T17:20:00').toISOString(),
    contact: {
      id: 'contact-2',
      name: 'João Silva',
      phone: '+55 11 88888-8888',
      email: 'joao@example.com',
      avatar:
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face',
      tags: ['Suporte'],
    },
  },
  {
    id: 'conv-3',
    contactId: 'contact-3',
    channel: 'facebook',
    status: 'open',
    assignedTo: 'user-3',
    lastMessageAt: new Date('2024-01-16T16:45:00').toISOString(),
    unreadCount: 1,
    tags: ['Vendas'],
    priority: 'low',
    createdAt: new Date('2024-01-15T09:30:00').toISOString(),
    updatedAt: new Date('2024-01-16T16:45:00').toISOString(),
    contact: {
      id: 'contact-3',
      name: 'Ana Costa',
      phone: '+55 11 77777-7777',
      email: 'ana@example.com',
      avatar:
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=40&h=40&fit=crop&crop=face',
      tags: ['Vendas'],
    },
  },
];

export const FALLBACK_CONVERSATION_MESSAGES: Record<string, Message[]> = {
  'conv-1': [
    {
      id: 'conv-1-msg-1',
      conversationId: 'conv-1',
      senderId: 'contact-1',
      content: 'Obrigada pelo atendimento!',
      type: 'text',
      direction: 'inbound',
      status: 'read',
      createdAt: new Date('2024-01-16T17:35:00').toISOString(),
    },
    {
      id: 'conv-1-msg-2',
      conversationId: 'conv-1',
      content: 'Disponha! Caso precise de mais alguma coisa é só chamar.',
      type: 'text',
      direction: 'outbound',
      status: 'read',
      createdAt: new Date('2024-01-16T17:34:00').toISOString(),
    },
  ],
  'conv-2': [
    {
      id: 'conv-2-msg-1',
      conversationId: 'conv-2',
      senderId: 'contact-2',
      content: 'Preciso de ajuda com meu pedido #1234',
      type: 'text',
      direction: 'inbound',
      status: 'sent',
      createdAt: new Date('2024-01-16T17:15:00').toISOString(),
    },
    {
      id: 'conv-2-msg-2',
      conversationId: 'conv-2',
      senderId: 'contact-2',
      content: 'Ainda não recebi nenhuma atualização.',
      type: 'text',
      direction: 'inbound',
      status: 'sent',
      createdAt: new Date('2024-01-16T17:18:00').toISOString(),
    },
  ],
  'conv-3': [
    {
      id: 'conv-3-msg-1',
      conversationId: 'conv-3',
      senderId: 'contact-3',
      content: 'Gostaria de saber mais sobre os preços.',
      type: 'text',
      direction: 'inbound',
      status: 'sent',
      createdAt: new Date('2024-01-16T16:45:00').toISOString(),
    },
  ],
};

const buildQueryKey = (filters?: ConversationsFilters) => [
  'conversations',
  Object.entries(filters ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce<Record<string, any>>((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        acc[key] = value;
      }
      return acc;
    }, {}),
];

export function useConversations(filters?: ConversationsFilters) {
  const query = useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: () => conversasService.getConversations(filters),
    retry: 1,
  });

  const usingFallback = query.isError;

  const conversations = useMemo<Conversation[]>(() => {
    if (query.data?.data && query.data.data.length > 0) {
      return query.data.data;
    }
    if (usingFallback) {
      return FALLBACK_CONVERSATIONS;
    }
    return query.data?.data ?? [];
  }, [query.data, usingFallback]);

  return {
    conversations,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback: usingFallback,
    refetch: query.refetch,
  };
}

export function useConversationMessages(conversationId?: string) {
  const query = useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () => conversasService.getMessages(conversationId!, 1, 100),
    enabled: Boolean(conversationId),
    retry: 1,
  });

  const isFallback = !conversationId || query.isError;

  const messages = useMemo<Message[]>(() => {
    if (!conversationId) return [];
    if (query.data?.data && query.data.data.length > 0) {
      return query.data.data;
    }
    if (isFallback) {
      return FALLBACK_CONVERSATION_MESSAGES[conversationId] ?? [];
    }
    return query.data?.data ?? [];
  }, [conversationId, query.data, isFallback]);

  return {
    messages,
    isLoading: query.isLoading,
    isError: query.isError,
    isFallback,
    refetch: query.refetch,
  };
}

export function useSendConversationMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SendMessageData) => conversasService.sendMessage(data),
    onSuccess: (message) => {
      const conversationId = (message as Message)?.conversationId ?? null;
      toast.success('Mensagem enviada com sucesso!');
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error: any) => {
      const message = error?.message ?? 'Não foi possível enviar a mensagem.';
      toast.error(message);
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => conversasService.markAsRead(conversationId),
    onSuccess: (_result, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
    },
  });
}

export function buildOutboundMessage(
  conversationId: string,
  content: string,
): Message {
  return {
    id: `fallback-${conversationId}-${Date.now()}`,
    conversationId,
    content,
    type: 'text',
    direction: 'outbound',
    status: 'sent',
    createdAt: now(),
  };
}
