import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare,
  Phone,
  Video,
  Paperclip,
  Send,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreHorizontal,
  Smile,
  Mic,
  Image,
  RefreshCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useConversations,
  useConversationMessages,
  useSendConversationMessage,
  useMarkConversationRead,
  FALLBACK_CONVERSATION_MESSAGES,
  buildOutboundMessage,
} from '@/hooks/useConversations';
import type {
  Conversation,
  ConversationsFilters,
  Message,
} from '@/services/conversas';

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

type SelectedConversationState = {
  id: string | null;
  conversation: Conversation | null;
};

const CHANNEL_DISPLAY: Record<
  Conversation['channel'],
  { label: string; color: string }
> = {
  whatsapp: { label: 'WhatsApp', color: 'bg-green-500' },
  facebook: { label: 'Facebook', color: 'bg-blue-500' },
  instagram: { label: 'Instagram', color: 'bg-purple-500' },
  email: { label: 'E-mail', color: 'bg-orange-500' },
  webchat: { label: 'Chat', color: 'bg-teal-500' },
};

const STATUS_DISPLAY: Record<
  Conversation['status'],
  { label: string; className: string; icon: JSX.Element | null }
> = {
  open: {
    label: 'Aberta',
    className: 'bg-blue-100 text-blue-700',
    icon: <AlertCircle className="mr-1 h-3 w-3" />,
  },
  pending: {
    label: 'Pendente',
    className: 'bg-yellow-100 text-yellow-700',
    icon: <Clock className="mr-1 h-3 w-3" />,
  },
  closed: {
    label: 'Resolvida',
    className: 'bg-green-100 text-green-700',
    icon: <CheckCircle className="mr-1 h-3 w-3" />,
  },
};

const PRIORITY_BADGE: Record<
  Conversation['priority'],
  { label: string; className: string }
> = {
  low: { label: 'Baixa', className: 'bg-emerald-100 text-emerald-700' },
  medium: { label: 'Média', className: 'bg-blue-100 text-blue-700' },
  high: { label: 'Alta', className: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgente', className: 'bg-red-100 text-red-700' },
};

const formatTime = (isoDate: string | undefined) => {
  if (!isoDate) return '--:--';
  return new Date(isoDate).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatRelativeDate = (isoDate: string | undefined) => {
  if (!isoDate) return '-';
  const date = new Date(isoDate);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getChannelInfo = (channel: Conversation['channel']) =>
  CHANNEL_DISPLAY[channel] ?? { label: channel, color: 'bg-gray-500' };

const getStatusDisplay = (status: Conversation['status']) =>
  STATUS_DISPLAY[status] ?? {
    label: status,
    className: 'bg-gray-100 text-gray-700',
    icon: null,
  };

const getPriorityDisplay = (priority: Conversation['priority']) =>
  PRIORITY_BADGE[priority] ?? {
    label: priority,
    className: 'bg-gray-100 text-gray-700',
  };

const filterConversations = (
  conversations: Conversation[],
  search: string,
) => {
  if (!search.trim()) {
    return conversations;
  }

  const normalized = search.toLowerCase();
  return conversations.filter((conversation) => {
    const name = conversation.contact?.name?.toLowerCase() ?? '';
    const tags = conversation.tags.join(' ').toLowerCase();
    const channel = conversation.channel.toLowerCase();
    return (
      name.includes(normalized) ||
      tags.includes(normalized) ||
      channel.includes(normalized)
    );
  });
};

const conversationLastMessage = (conversation: Conversation, messages: Message[]) => {
  if (conversation.lastMessage) {
    return conversation.lastMessage.content;
  }
  if (messages.length > 0) {
    return messages[messages.length - 1].content;
  }
  return 'Sem mensagens';
};

export default function Atendimentos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [fallbackMessages, setFallbackMessages] = useState(
    FALLBACK_CONVERSATION_MESSAGES,
  );
  const [selectedState, setSelectedState] = useState<SelectedConversationState>({
    id: null,
    conversation: null,
  });

  const queryFilters = useMemo(() => {
    const filters: ConversationsFilters = {};
    if (searchTerm.trim()) {
      filters.search = searchTerm.trim();
    }
    return filters;
  }, [searchTerm]);

  const {
    conversations,
    isLoading: conversationsLoading,
    isFallback: conversationsFallback,
    refetch: refetchConversations,
  } = useConversations(queryFilters);

  const selectedConversation =
    selectedState.conversation &&
    conversations.some((conversation) => conversation.id === selectedState.conversation?.id)
      ? selectedState.conversation
      : conversations[0] ?? null;

  const selectedConversationId = selectedConversation?.id ?? null;

  useEffect(() => {
    if (selectedConversation && selectedConversation.id !== selectedState.id) {
      setSelectedState({ id: selectedConversation.id, conversation: selectedConversation });
    }
    if (!selectedConversation && conversations.length > 0) {
      setSelectedState({ id: conversations[0].id, conversation: conversations[0] });
    }
  }, [conversations, selectedConversation, selectedState.id]);

  const {
    messages,
    isLoading: messagesLoading,
    isFallback: messagesFallback,
    refetch: refetchMessages,
  } = useConversationMessages(selectedConversationId ?? undefined);

  const sendMessageMutation = useSendConversationMessage();
  const markAsReadMutation = useMarkConversationRead();

  useEffect(() => {
    if (selectedConversationId && !conversationsFallback) {
      markAsReadMutation.mutate(selectedConversationId, {
        onError: () => {
          /* ignore */
        },
      });
    }
  }, [selectedConversationId, conversationsFallback, markAsReadMutation]);

  const conversationMessages: Message[] = useMemo(() => {
    if (!selectedConversationId) {
      return [];
    }
    if (messagesFallback || conversationsFallback) {
      return fallbackMessages[selectedConversationId] ?? [];
    }
    return messages;
  }, [
    conversationsFallback,
    fallbackMessages,
    messages,
    messagesFallback,
    selectedConversationId,
  ]);

  const filteredConversations = useMemo(
    () => filterConversations(conversations, searchTerm),
    [conversations, searchTerm],
  );

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedState({ id: conversation.id, conversation });
  };

  const handleSendMessage = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !selectedConversationId) {
      return;
    }

    setNewMessage('');

    if (conversationsFallback || messagesFallback) {
      setFallbackMessages((prev) => {
        const existing = prev[selectedConversationId] ?? [];
        return {
          ...prev,
          [selectedConversationId]: [
            ...existing,
            buildOutboundMessage(selectedConversationId, trimmed),
          ],
        };
      });
      toast.success('Mensagem registrada no modo offline.');
      return;
    }

    try {
      await sendMessageMutation.mutateAsync({
        conversationId: selectedConversationId,
        content: trimmed,
        type: 'text',
      });
      await refetchMessages();
    } catch (error) {
      toast.error(getErrorMessage(error, 'Não foi possível enviar a mensagem.'));
      setNewMessage(trimmed);
    }
  };

  const activeConversationMessages = conversationMessages;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Atendimentos</h1>
          <p className="text-muted-foreground">
            Central omnichannel de atendimento
          </p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => refetchConversations()} disabled={conversationsLoading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>
          <Button>
            <MessageSquare className="mr-2 h-4 w-4" />
            Novo Chat
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 h-[600px]">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                className="pl-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[520px]">
              <div className="space-y-1 p-2">
                {conversationsLoading && filteredConversations.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-muted-foreground">
                    Carregando conversas...
                  </p>
                ) : filteredConversations.length === 0 ? (
                  <p className="px-3 py-6 text-sm text-muted-foreground">
                    Nenhuma conversa encontrada.
                  </p>
                ) : (
                  filteredConversations.map((conversation) => {
                    const channelInfo = getChannelInfo(conversation.channel);
                    const statusInfo = getStatusDisplay(conversation.status);
                    const isSelected = selectedConversationId === conversation.id;
                    const contactName = conversation.contact?.name ?? 'Contato';
                    const lastMessage = conversationLastMessage(
                      conversation,
                      activeConversationMessages,
                    );
                    const contactAvatar = conversation.contact?.avatar;

                    return (
                      <motion.div
                        key={conversation.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className={`p-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handleSelectConversation(conversation)}
                      >
                        <div className="flex items-start space-x-3">
                          <div className="relative">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={contactAvatar} />
                              <AvatarFallback>
                                {contactName
                                  .split(' ')
                                  .map((word) => word[0])
                                  .join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div
                              className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ${channelInfo.color}`}
                            >
                              <MessageSquare className="h-2 w-2 text-white" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">
                                {contactName}
                              </p>
                              <div className="flex items-center space-x-1">
                                {conversation.unreadCount > 0 && (
                                  <Badge
                                    variant="destructive"
                                    className="px-1.5 py-0.5 text-xs"
                                  >
                                    {conversation.unreadCount}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatTime(conversation.lastMessageAt)}
                                </span>
                              </div>
                            </div>

                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {lastMessage}
                            </p>

                            <div className="mt-2 flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {conversation.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {conversation.tags.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{conversation.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                              <Badge
                                className={`text-xs ${statusInfo.className}`}
                              >
                                {statusInfo.icon}
                                {statusInfo.label}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              <CardHeader className="flex flex-row items-center space-y-0 border-b pb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedConversation.contact?.avatar} />
                  <AvatarFallback>
                    {selectedConversation.contact?.name
                      ?.split(' ')
                      .map((word) => word[0])
                      .join('') ?? 'C'}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-3 flex-1">
                  <h3 className="font-semibold">
                    {selectedConversation.contact?.name ?? 'Contato'}
                  </h3>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <span
                      className={`inline-flex h-2 w-2 rounded-full ${
                        getChannelInfo(selectedConversation.channel).color
                      }`}
                    />
                    {getChannelInfo(selectedConversation.channel).label}
                    <Separator orientation="vertical" className="h-3" />
                    {getPriorityDisplay(selectedConversation.priority).label}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-[400px] p-4">
                  {messagesLoading && !messagesFallback ? (
                    <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
                  ) : (
                    <div className="space-y-4">
                      {activeConversationMessages.map((message) => {
                        const isOutbound = message.direction === 'outbound';
                        const bubbleClasses = isOutbound
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted';
                        const timestamp = formatRelativeDate(message.createdAt);
                        const displayName = isOutbound
                          ? 'Você'
                          : selectedConversation.contact?.name ?? 'Contato';
                        const avatar = isOutbound
                          ? undefined
                          : selectedConversation.contact?.avatar;

                        return (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`flex max-w-[70%] items-end space-x-2 ${
                                isOutbound ? 'flex-row-reverse space-x-reverse' : ''
                              }`}
                            >
                              {!isOutbound && (
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={avatar} />
                                  <AvatarFallback className="text-xs">
                                    {displayName
                                      .split(' ')
                                      .map((word) => word[0])
                                      .join('')}
                                  </AvatarFallback>
                                </Avatar>
                              )}
                              <div className={`rounded-2xl px-4 py-2 ${bubbleClasses}`}>
                                <p className="text-sm">{message.content}</p>
                                <p
                                  className={`mt-1 text-xs ${
                                    isOutbound
                                      ? 'text-primary-foreground/70'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  {timestamp}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              <div className="border-t p-4">
                <div className="flex items-end space-x-2">
                  <div className="flex-1 space-y-2">
                    <Textarea
                      placeholder={
                        conversationsFallback
                          ? 'Modo offline: a mensagem será registrada localmente'
                          : 'Digite sua mensagem...'
                      }
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[60px] resize-none"
                    />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm">
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Image className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Smile className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Mic className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm">
                          Resposta Rápida
                        </Button>
                        <Button onClick={handleSendMessage} size="sm">
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center space-y-2 text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10" />
              <p className="text-sm">Selecione uma conversa para visualizar os detalhes.</p>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}
