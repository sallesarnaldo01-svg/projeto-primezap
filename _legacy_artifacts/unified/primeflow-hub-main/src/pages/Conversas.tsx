// src/pages/Conversas.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import api from '@/lib/api';
import { 
  MessageCircle, 
  Send, 
  Paperclip, 
  Mic, 
  Image as ImageIcon,
  Video,
  Search,
  Archive,
  MoreVertical,
  Check,
  CheckCheck
} from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar_url?: string;
}

interface Message {
  id: string;
  content: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document';
  sender: 'user' | 'contact' | 'system';
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  media_url?: string;
  created_at: string;
  delivered_at?: string;
  read_at?: string;
}

type RealtimeMessagePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Message;
};

interface Conversation {
  id: string;
  status: string;
  last_message_content: string;
  last_message_at: string;
  last_message_from: string;
  unread_count: number;
  message_count: number;
  created_at: string;
  updated_at: string;
  contact: Contact;
  messages?: Message[];
}

export default function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar conversas
  useEffect(() => {
    loadConversations();
    
    // Inscrever para atualizações em tempo real
    const channel = supabase
      .channel('conversations')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'conversations' },
        () => loadConversations()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => handleNewMessage(payload)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadConversations, handleNewMessage]);

  // Auto-scroll para última mensagem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Carregar conversas
  const loadConversations = useCallback(async () => {
    try {
      const response = await api.get('/conversations');
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Selecionar conversa
  const selectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    
    try {
      const response = await api.get(`/conversations/${conversation.id}`);
      setMessages(response.data.messages || []);
      
      // Marcar como lida
      await api.post(`/conversations/${conversation.id}/mark-as-read`);
      
      // Atualizar contador local
      setConversations(prev =>
        prev.map(c =>
          c.id === conversation.id
            ? { ...c, unread_count: 0 }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to load conversation', error);
    }
  };

  // Enviar mensagem
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim() || !selectedConversation || sending) return;

    const content = messageInput.trim();
    setMessageInput('');
    setSending(true);

    try {
      // Adicionar mensagem otimisticamente
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        content,
        type: 'text',
        sender: 'user',
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      
      setMessages(prev => [...prev, optimisticMessage]);

      // Enviar para o backend
      const response = await api.post(
        `/conversations/${selectedConversation.id}/messages`,
        { content, type: 'text' }
      );

      // Atualizar mensagem com resposta do servidor
      setMessages(prev =>
        prev.map(m =>
          m.id === optimisticMessage.id ? response.data : m
        )
      );

      // Atualizar última mensagem na lista
      setConversations(prev =>
        prev.map(c =>
          c.id === selectedConversation.id
            ? {
                ...c,
                last_message_content: content,
                last_message_at: new Date().toISOString(),
                last_message_from: 'user',
              }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to send message', error);
      // Remover mensagem otimista em caso de erro
      setMessages(prev => prev.filter(m => !m.id.startsWith('temp-')));
    } finally {
      setSending(false);
    }
  };

  // Lidar com nova mensagem via WebSocket
  const handleNewMessage = useCallback((payload: RealtimeMessagePayload) => {
    if (payload.eventType !== 'INSERT') {
      return;
    }

    const newMessage = payload.new;

    if (selectedConversation && newMessage.conversation_id === selectedConversation.id) {
      setMessages((prev) => [...prev, newMessage]);

      if (newMessage.sender === 'contact') {
        setIsTyping(true);
        setTimeout(() => setIsTyping(false), 2000);
      }
    }

    loadConversations();
  }, [selectedConversation, loadConversations]);

  // Scroll para o final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Formatar data
  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 48) {
      return 'Ontem';
    } else {
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
  };

  // Renderizar ícone de status
  const renderStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      default:
        return null;
    }
  };

  // Filtrar conversas
  const filteredConversations = conversations.filter(c =>
    c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact.phone.includes(searchQuery)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Lista de Conversas */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Conversas</h1>
          
          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar conversas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="w-16 h-16 mb-4" />
              <p>Nenhuma conversa encontrada</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => selectConversation(conversation)}
                className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition ${
                  selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {conversation.contact.avatar_url ? (
                      <img
                        src={conversation.contact.avatar_url}
                        alt={conversation.contact.name}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                        {conversation.contact.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-semibold text-gray-900 truncate">
                        {conversation.contact.name}
                      </h3>
                      <span className="text-xs text-gray-500">
                        {formatDate(conversation.last_message_at)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600 truncate">
                        {conversation.last_message_from === 'user' && 'Você: '}
                        {conversation.last_message_content}
                      </p>
                      
                      {conversation.unread_count > 0 && (
                        <span className="ml-2 bg-blue-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Área de Mensagens */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Header da Conversa */}
            <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {selectedConversation.contact.avatar_url ? (
                  <img
                    src={selectedConversation.contact.avatar_url}
                    alt={selectedConversation.contact.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold">
                    {selectedConversation.contact.name.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {selectedConversation.contact.name}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedConversation.contact.phone}
                  </p>
                </div>
              </div>

              <button className="p-2 hover:bg-gray-100 rounded-lg transition">
                <MoreVertical className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Mensagens */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      message.sender === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-white text-gray-900 border border-gray-200'
                    }`}
                  >
                    {/* Conteúdo da mensagem */}
                    {message.type === 'text' && (
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    )}
                    
                    {message.type === 'image' && message.media_url && (
                      <img
                        src={message.media_url}
                        alt="Imagem"
                        className="rounded-lg max-w-full"
                      />
                    )}
                    
                    {message.type === 'video' && message.media_url && (
                      <video
                        src={message.media_url}
                        controls
                        className="rounded-lg max-w-full"
                      />
                    )}
                    
                    {message.type === 'audio' && message.media_url && (
                      <audio src={message.media_url} controls className="w-full" />
                    )}

                    {/* Timestamp e status */}
                    <div className="flex items-center justify-end space-x-1 mt-1">
                      <span className={`text-xs ${message.sender === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                        {formatDate(message.created_at)}
                      </span>
                      {message.sender === 'user' && renderStatusIcon(message.status)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Indicador de "digitando..." */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-lg p-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input de Mensagem */}
            <div className="bg-white border-t border-gray-200 p-4">
              <form onSubmit={sendMessage} className="flex items-center space-x-2">
                <button
                  type="button"
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  <Paperclip className="w-5 h-5 text-gray-600" />
                </button>

                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={sending}
                />

                <button
                  type="submit"
                  disabled={!messageInput.trim() || sending}
                  className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <MessageCircle className="w-24 h-24 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Selecione uma conversa</h2>
            <p>Escolha uma conversa da lista para começar a enviar mensagens</p>
          </div>
        )}
      </div>
    </div>
  );
}
