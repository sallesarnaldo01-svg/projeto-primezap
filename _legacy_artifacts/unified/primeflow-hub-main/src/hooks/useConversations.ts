import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  conversasService,
  type Conversation,
  type ConversationsFilters,
  type Message,
  type SendMessageData,
} from '@/services/conversas';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      response?: { data?: { error?: string } };
      message?: string;
    };

    return maybeError.response?.data?.error ?? maybeError.message ?? fallback;
  }

  return fallback;
};

export const FALLBACK_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    contactId: 'contact-1',
    channel: 'whatsapp',
    status: 'open',
    assignedTo: 'user-1',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 2,
    tags: ['VIP'],
    priority: 'high',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    contact: {
      id: 'contact-1',
      name: 'João Silva',
      phone: '+55 11 99999-0001',
      email: 'joao@example.com',
      tags: ['VIP'],
    },
    assignee: {
      id: 'user-1',
      name: 'Maria Souza',
      email: 'maria@primezap.com',
    },
    messages: [],
  },
  {
    id: 'conv-2',
    contactId: 'contact-2',
    channel: 'instagram',
    status: 'pending',
    assignedTo: 'user-2',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    tags: ['Lead'],
    priority: 'medium',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contact: {
      id: 'contact-2',
      name: 'Ana Pereira',
      phone: '+55 21 98888-1111',
      email: 'ana@example.com',
      tags: ['Lead'],
    },
    assignee: {
      id: 'user-2',
      name: 'Carlos Lima',
      email: 'carlos@primezap.com',
    },
    messages: [],
  },
];

export const FALLBACK_CONVERSATION_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'contact-1',
    content: 'Olá! Preciso de ajuda com meu pedido.',
    type: 'text',
    direction: 'inbound',
    status: 'read',
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    attachments: [],
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'Claro, João! Vou verificar aqui para você.',
    type: 'text',
    direction: 'outbound',
    status: 'delivered',
    createdAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    attachments: [],
  },
];

const mapConversationResponse = (
  response?: Awaited<ReturnType<typeof conversasService.getConversations>>,
): Conversation[] => {
  if (!response) return [];
  return response.data;
};

export function useConversations(filters?: ConversationsFilters) {
  const query = useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => conversasService.getConversations(filters),
    retry: 1,
  });

  const conversations = useMemo(() => {
    if (query.isSuccess) {
      return mapConversationResponse(query.data);
    }
    if (query.isError) {
      return FALLBACK_CONVERSATIONS;
    }
    return [];
  }, [query.data, query.isError, query.isSuccess]);

  return {
    conversations,
    pagination: query.data?.pagination,
    isLoading: query.isLoading,
    isFallback: query.isError,
    refetch: query.refetch,
  };
}

export function useConversationMessages(conversationId?: string) {
  return useQuery({
    queryKey: ['conversation-messages', conversationId],
    queryFn: () =>
      conversationId
        ? conversasService.getMessages(conversationId)
        : Promise.reject('missing conversation id'),
    enabled: Boolean(conversationId),
  });
}

export const buildOutboundMessage = (
  conversationId: string,
  content: string,
): SendMessageData => ({
  conversationId,
  content,
  type: 'text',
});

export function useSendConversationMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SendMessageData) => conversasService.sendMessage(payload),
    onSuccess: (message) => {
      toast.success('Mensagem enviada!');
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', message.conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (error) => {
      const message = getErrorMessage(error, 'Não foi possível enviar a mensagem.');
      toast.error(message);
    },
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => conversasService.markAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', conversationId] });
    },
    onError: () => {
      toast.error('Não foi possível marcar a conversa como lida.');
    },
  });
}
