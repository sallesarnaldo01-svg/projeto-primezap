import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageSquare, Search, Send, Paperclip, Check, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { conversasService, type Conversation, type Message } from '@/services/conversas';
import { MultiChannelComposer } from '@/components/MultiChannelComposer';
import { useSocket } from '@/hooks/useSocket';
import { supabase } from '@/integrations/supabase/client';

function formatTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export default function Conversas() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [composer, setComposer] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useSocket();

  const loadConversations = async () => {
    try {
      const res = await conversasService.getConversations({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: searchTerm || undefined,
        limit: 50,
      });
      setConversations(res.data);
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId: string) => {
    try {
      const res = await conversasService.getMessages(conversationId, 1, 100);
      setMessages(res.data);
      await conversasService.markAsRead(conversationId);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)));
    } catch (e) {
      console.error(e);
      toast.error('Falha ao carregar mensagens');
    }
  };

  useEffect(() => {
    loadConversations();
  }, [statusFilter]);

  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel(`messages:${selected.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selected.id}`,
      }, (payload) => {
        const newMsg = payload.new as unknown as Message;
        setMessages((prev) => [...prev, newMsg]);
        setConversations((prev) => prev.map((c) => (c.id === selected.id ? ({ ...c, lastMessage: newMsg } as any) : c)));
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected?.id]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return conversations.filter((c) => {
      const name = c.contact?.name?.toLowerCase() || '';
      const phone = c.contact?.phone || '';
      return !q || name.includes(q) || phone.includes(q);
    });
  }, [conversations, searchTerm]);

  const handleSelect = async (c: Conversation) => {
    setSelected(c);
    await loadMessages(c.id);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !composer.trim()) return;
    const content = composer.trim();
    setComposer('');
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      conversationId: selected.id,
      content,
      type: 'text',
      direction: 'outbound',
      status: 'sent',
      createdAt: new Date().toISOString(),
    } as Message;
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await conversasService.sendMessage({ conversationId: selected.id, content });
      setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? res.data : m)));
    } catch (e) {
      toast.error('Erro ao enviar mensagem');
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    }
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
      <Card className="col-span-4 flex flex-col">
        <CardHeader>
          <CardTitle>Conversas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abertas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="closed">Fechadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          <div className="max-h-[65vh] overflow-y-auto space-y-2">
            {loading ? (
              <div className="text-sm text-muted-foreground">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground flex items-center gap-2"><Search className="h-4 w-4" /> Nenhuma conversa</div>
            ) : (
              filtered.map((c) => (
                <button key={c.id} onClick={() => handleSelect(c)} className={`w-full text-left p-3 border rounded-md hover:bg-muted ${selected?.id === c.id ? 'bg-muted' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      <div>
                        <div className="font-medium text-sm">{c.contact?.name || 'Contato'}</div>
                        <div className="text-xs text-muted-foreground">{c.contact?.phone || '—'}</div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{formatTime((c as any).lastMessageAt)}</div>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div className="text-xs text-muted-foreground line-clamp-1">{(c as any).lastMessage?.content || ''}</div>
                    {!!(c as any).unreadCount && (<Badge variant="secondary">{(c as any).unreadCount}</Badge>)}
                  </div>
                  <div className="mt-1">
                    <Badge variant="outline">{c.channel}</Badge>
                    <Badge variant="secondary" className="ml-2">{c.status}</Badge>
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-8 flex flex-col">
        <CardHeader>
          <CardTitle>{selected ? selected.contact?.name || 'Conversa' : 'Selecione uma conversa'}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          <div className="flex-1 overflow-y-auto space-y-3 p-1">
            {selected ? (
              messages.map((m) => (
                <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`rounded-md px-3 py-2 max-w-[75%] ${m.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                    <div className="text-[10px] opacity-70 flex items-center gap-1 mt-1">
                      {formatTime(m.createdAt)}
                      {m.direction === 'outbound' && (m.status === 'read' ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">Nenhuma conversa selecionada</div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {selected && (
            <form onSubmit={sendMessage} className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon"><Paperclip className="h-4 w-4" /></Button>
              <Input placeholder="Digite sua mensagem..." value={composer} onChange={(e) => setComposer(e.target.value)} />
              <Button type="submit" disabled={!composer.trim()}><Send className="h-4 w-4 mr-1" /> Enviar</Button>
            </form>
          )}

          <Dialog>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Disparo em Massa</DialogTitle>
              </DialogHeader>
              <MultiChannelComposer channels={["whatsapp", "facebook", "instagram"]} onSend={() => toast.success('Disparo iniciado')} />
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
