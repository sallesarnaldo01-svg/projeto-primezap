import { useState, useEffect } from 'react';
import { useMessagesRealtime, useConversationsRealtime } from '../hooks/useSupabaseRealtime';

/**
 * Exemplo de componente usando Supabase Realtime
 * 
 * Este componente demonstra como usar os hooks de realtime
 * para atualizar a UI automaticamente quando há mudanças no banco.
 */
export function RealtimeExample() {
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Escutar novas mensagens na conversa selecionada
  const { isConnected: messagesConnected } = useMessagesRealtime(
    selectedConversationId,
    (newMessage) => {
      console.log('Nova mensagem recebida:', newMessage);
      
      // Adicionar mensagem à lista
      setMessages((prev) => [...prev, newMessage]);
      
      // Notificação (opcional)
      if (Notification.permission === 'granted') {
        new Notification('Nova mensagem', {
          body: newMessage.content || 'Você recebeu uma nova mensagem',
          icon: '/logo.png',
        });
      }
      
      // Som de notificação (opcional)
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {});
    }
  );

  // Escutar mudanças em conversas
  const { isConnected: conversationsConnected } = useConversationsRealtime(
    'tenant-id-aqui', // Substituir pelo tenant ID real
    (conversation) => {
      console.log('Conversa atualizada:', conversation);
      
      // Atualizar lista de conversas
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === conversation.id);
        if (index >= 0) {
          // Atualizar conversa existente
          const updated = [...prev];
          updated[index] = conversation;
          return updated;
        } else {
          // Adicionar nova conversa
          return [conversation, ...prev];
        }
      });
    }
  );

  // Solicitar permissão para notificações
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Supabase Realtime Example</h1>
      
      {/* Status de conexão */}
      <div className="mb-6 flex gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${messagesConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            Messages: {messagesConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${conversationsConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm">
            Conversations: {conversationsConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Lista de conversas */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Conversas</h2>
        <div className="space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`p-3 border rounded cursor-pointer hover:bg-gray-50 ${
                selectedConversationId === conv.id ? 'bg-blue-50 border-blue-500' : ''
              }`}
              onClick={() => setSelectedConversationId(conv.id)}
            >
              <div className="font-medium">{conv.contact_name || 'Sem nome'}</div>
              <div className="text-sm text-gray-500">{conv.last_message || 'Sem mensagens'}</div>
            </div>
          ))}
          
          {conversations.length === 0 && (
            <div className="text-gray-500 text-center py-4">
              Nenhuma conversa encontrada
            </div>
          )}
        </div>
      </div>

      {/* Lista de mensagens */}
      {selectedConversationId && (
        <div>
          <h2 className="text-xl font-semibold mb-2">Mensagens</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-3 rounded ${
                  msg.direction === 'outbound' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
                } max-w-md`}
              >
                <div className="text-sm">{msg.content}</div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </div>
              </div>
            ))}
            
            {messages.length === 0 && (
              <div className="text-gray-500 text-center py-4">
                Nenhuma mensagem nesta conversa
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default RealtimeExample;
