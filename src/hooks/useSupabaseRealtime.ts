import { useEffect, useRef, useState } from 'react';
import { createClient, RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface UseSupabaseRealtimeOptions<T = any> {
  table: string;
  schema?: string;
  event?: RealtimeEvent;
  filter?: string;
  onInsert?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
}

/**
 * Hook para escutar mudanças em tempo real no Supabase
 * 
 * @example
 * // Escutar todas as mudanças em messages
 * useSupabaseRealtime({
 *   table: 'messages',
 *   onChange: (payload) => {
 *     console.log('Change received!', payload);
 *   }
 * });
 * 
 * @example
 * // Escutar apenas INSERTs
 * useSupabaseRealtime({
 *   table: 'messages',
 *   event: 'INSERT',
 *   onInsert: (payload) => {
 *     setMessages(prev => [...prev, payload.new]);
 *   }
 * });
 * 
 * @example
 * // Escutar mudanças com filtro
 * useSupabaseRealtime({
 *   table: 'messages',
 *   filter: `conversation_id=eq.${conversationId}`,
 *   onChange: (payload) => {
 *     // Atualizar UI
 *   }
 * });
 */
export function useSupabaseRealtime<T = any>(options: UseSupabaseRealtimeOptions<T>) {
  const {
    table,
    schema = 'public',
    event = '*',
    filter,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  } = options;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Criar nome único para o canal
    const channelName = `${schema}:${table}${filter ? `:${filter}` : ''}`;

    try {
      // Criar canal
      const channel = supabase.channel(channelName);

      // Configurar listener
      channel.on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          filter,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          // Callback genérico
          onChange?.(payload);

          // Callbacks específicos por tipo de evento
          switch (payload.eventType) {
            case 'INSERT':
              onInsert?.(payload);
              break;
            case 'UPDATE':
              onUpdate?.(payload);
              break;
            case 'DELETE':
              onDelete?.(payload);
              break;
          }
        }
      );

      // Subscribe
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
          console.log(`✅ Subscribed to ${channelName}`);
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          setError(new Error(`Failed to subscribe to ${channelName}`));
          console.error(`❌ Failed to subscribe to ${channelName}`);
        } else if (status === 'TIMED_OUT') {
          setIsConnected(false);
          setError(new Error(`Subscription to ${channelName} timed out`));
          console.error(`⏱️ Subscription to ${channelName} timed out`);
        }
      });

      channelRef.current = channel;
    } catch (err) {
      setError(err as Error);
      console.error('Error setting up Supabase Realtime:', err);
    }

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
        console.log(`🔌 Unsubscribed from ${channelName}`);
      }
    };
  }, [table, schema, event, filter, onInsert, onUpdate, onDelete, onChange]);

  return { isConnected, error, supabase };
}

/**
 * Hook para escutar mudanças em messages
 */
export function useMessagesRealtime(
  conversationId: string | null,
  onNewMessage: (message: any) => void
) {
  return useSupabaseRealtime({
    table: 'messages',
    event: 'INSERT',
    filter: conversationId ? `conversation_id=eq.${conversationId}` : undefined,
    onInsert: (payload) => {
      onNewMessage(payload.new);
    },
  });
}

/**
 * Hook para escutar mudanças em conversations
 */
export function useConversationsRealtime(
  tenantId: string | null,
  onConversationChange: (conversation: any) => void
) {
  return useSupabaseRealtime({
    table: 'conversations',
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    onChange: (payload) => {
      onConversationChange(payload.new || payload.old);
    },
  });
}

/**
 * Hook para escutar mudanças em contacts
 */
export function useContactsRealtime(
  tenantId: string | null,
  onContactChange: (contact: any) => void
) {
  return useSupabaseRealtime({
    table: 'contacts',
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    onChange: (payload) => {
      onContactChange(payload.new || payload.old);
    },
  });
}

/**
 * Hook para escutar mudanças em leads
 */
export function useLeadsRealtime(
  tenantId: string | null,
  onLeadChange: (lead: any) => void
) {
  return useSupabaseRealtime({
    table: 'leads',
    filter: tenantId ? `tenant_id=eq.${tenantId}` : undefined,
    onChange: (payload) => {
      onLeadChange(payload.new || payload.old);
    },
  });
}

export default useSupabaseRealtime;
