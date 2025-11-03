import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, UserPlus, Filter, Download, TrendingUp, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScheduleVisitDialog } from '@/components/crm/ScheduleVisitDialog';
import LeadActionsKanban from '@/components/crm/LeadActionsKanban';
import { supabase } from '@/integrations/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Progress } from '@/components/ui/progress';
import type { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  status: string;
  score?: number;
  assigned_to: string | null;
  created_at: string;
}

const supabaseClient = supabase as SupabaseClient<Database>;

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [saleProbability, setSaleProbability] = useState<number>(0);
  const [timeline, setTimeline] = useState<Array<{ id: string; type: string; content?: string; createdAt: string }>>([]);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    let filtered = leads;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    if (searchTerm) {
      const normalized = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.name?.toLowerCase().includes(normalized) ||
          lead.email?.toLowerCase().includes(normalized) ||
          lead.phone?.includes(searchTerm)
      );
    }

    setFilteredLeads(filtered);
  }, [leads, statusFilter, searchTerm]);

  const loadLeads = async () => {
    try {
      // @ts-expect-error - Supabase types may be stale locally
      const { data, error } = await supabaseClient
        .from('contacts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      toast.error('Erro ao carregar leads');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const distributeLeads = async () => {
    try {
      // Buscar atendentes disponíveis
      // @ts-expect-error - Supabase types may be stale locally
      const { data: agents } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('role', 'agent')
        .limit(10);

      if (!agents || agents.length === 0) {
        toast.error('Nenhum atendente disponível');
        return;
      }

      // Leads não atribuídos
      const unassignedLeads = leads.filter(lead => !lead.assigned_to);
      
      if (unassignedLeads.length === 0) {
        toast.info('Não há leads para distribuir');
        return;
      }

      // Distribuir round-robin
      const updates = unassignedLeads.map((lead, index) => ({
        id: lead.id,
        assigned_to: agents[index % agents.length].id
      }));

      // @ts-expect-error - Supabase types may be stale locally
      const { error } = await supabaseClient
        .from('contacts')
        .upsert(updates);

      if (error) throw error;

      toast.success(`${updates.length} leads distribuídos com sucesso`);
      loadLeads();
    } catch (error) {
      toast.error('Erro ao distribuir leads');
      console.error(error);
    }
  };

  const exportLeads = () => {
    const csv = [
      ['Nome', 'Email', 'Telefone', 'Fonte', 'Status', 'Data'].join(','),
      ...filteredLeads.map(lead =>
        [
          lead.name,
          lead.email || '',
          lead.phone || '',
          lead.source || '',
          lead.status,
          new Date(lead.created_at).toLocaleDateString()
        ].join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString()}.csv`;
    a.click();
    toast.success('Leads exportados');
  };

  const openDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setSaleProbability((lead as any).sale_probability || 0);
    setDetailOpen(true);
    try {
      const { leadInteractionsService } = await import('@/services/leadInteractions');
      const list = await leadInteractionsService.list(lead.id);
      setTimeline(list as any);
    } catch {}
  };

  const addNote = async (content: string) => {
    if (!selectedLead) return;
    try {
      const { leadInteractionsService } = await import('@/services/leadInteractions');
      const created = await leadInteractionsService.add({ leadId: selectedLead.id, type: 'NOTE', content } as any);
      setTimeline((prev) => [created as any, ...prev]);
      toast.success('Anotação adicionada');
    } catch {
      toast.error('Falha ao adicionar anotação');
    }
  };

  const quickPreCadastro = async () => {
    if (!selectedLead) return;
    try {
      const { createPreCadastro } = await import('@/services/preCadastros');
      await createPreCadastro({ leadId: selectedLead.id, empreendimento: '—' });
      toast.success('Pré‑Cadastro criado');
    } catch {
      toast.error('Falha ao criar Pré‑Cadastro');
    }
  };

  const updateSaleProbability = async (value: number) => {
    if (!selectedLead) return;
    try {
      const { api } = await import('@/services/api');
      await api.post(`/api/leads/${selectedLead.id}/sale-probability`, { value });
      setSaleProbability(value);
      toast.success('Probabilidade atualizada');
    } catch {
      toast.error('Falha ao atualizar probabilidade');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      new: 'default',
      contacted: 'secondary',
      qualified: 'default',
      lost: 'destructive'
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (loading) {
    return <div className="container mx-auto p-6">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestão de Leads</h1>
          <p className="text-muted-foreground">Gerencie e distribua leads para sua equipe</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLeads}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" onClick={distributeLeads}>
            <UserPlus className="mr-2 h-4 w-4" />
            Distribuir
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Lead
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Total de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{leads.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Novos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {leads.filter(l => l.status === 'new').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Qualificados</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {leads.filter(l => l.status === 'qualified').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Não Atribuídos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {leads.filter(l => !l.assigned_to).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Buscar</Label>
              <Input
                placeholder="Nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-48">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="contacted">Contatado</SelectItem>
                  <SelectItem value="qualified">Qualificado</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredLeads.map((lead) => (
              <Card key={lead.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{lead.name}</h3>
                      {typeof lead.score === 'number' && lead.score >= 0 && (
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          <span className="text-xs font-semibold text-primary">{lead.score}%</span>
                          <Progress value={lead.score} className="w-16 h-2" />
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {lead.email || lead.phone}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fonte: {lead.source} • {new Date(lead.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getStatusBadge(lead.status)}
                    {lead.assigned_to ? (
                      <Badge variant="outline">Atribuído</Badge>
                    ) : (
                      <Badge variant="secondary">Não atribuído</Badge>
                    )}
                    <Button size="sm" variant="outline" onClick={() => openDetail(lead)}>
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {filteredLeads.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum lead encontrado
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <LeadDetailDialog open={detailOpen} onOpenChange={setDetailOpen} lead={selectedLead} saleProbability={saleProbability} setSaleProbability={setSaleProbability} timeline={timeline} onAddNote={addNote} onQuickPreCadastro={quickPreCadastro} />
    </div>
  );
}

function LeadDetailDialog({ open, onOpenChange, lead, saleProbability, setSaleProbability, timeline, onAddNote, onQuickPreCadastro }: any) {
  const [note, setNote] = useState('');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Lead • {lead?.name}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            <div className="p-3 border rounded-md">
                      <div className="text-sm text-muted-foreground">Probabilidade de venda (1–5)</div>
                      <div className="flex items-center gap-2 mt-2">
                {[1,2,3,4,5].map((v) => (
                  <button key={v} className={`px-2 py-1 rounded ${v <= saleProbability ? 'bg-primary text-primary-foreground' : 'bg-muted'}`} onClick={() => updateSaleProbability(v)}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3 border rounded-md">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium">Timeline</div>
                <div className="text-xs text-muted-foreground">{timeline?.length || 0} eventos</div>
              </div>
              <div className="space-y-2 max-h-64 overflow-auto">
                {timeline?.map((t: any) => (
                  <div key={t.id} className="p-2 border rounded-md">
                    <div className="text-xs text-muted-foreground">{new Date(t.createdAt).toLocaleString('pt-BR')} • {t.type}</div>
                    {t.content && <div className="text-sm">{t.content}</div>}
                  </div>
                ))}
                {(!timeline || timeline.length === 0) && <div className="text-sm text-muted-foreground">Sem interações ainda.</div>}
              </div>
              <div className="mt-2 flex gap-2">
                <Input placeholder="Adicionar anotação" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button onClick={() => { if (note.trim()) { onAddNote(note.trim()); setNote(''); } }}>Adicionar</Button>
              </div>
            </div>
            <div className="p-3 border rounded-md">
              <div className="font-medium mb-2">Kanban de Ações</div>
              {lead?.id && <LeadActionsKanban leadId={lead.id} />}
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-3 border rounded-md">
              <div className="text-sm">{lead?.email || '—'}</div>
              <div className="text-sm">{lead?.phone || '—'}</div>
              <div className="text-xs text-muted-foreground">Fonte: {lead?.source}</div>
            </div>
            <div className="space-y-2">
              <Button className="w-full" variant="secondary" onClick={onQuickPreCadastro}><Sparkles className="h-4 w-4 mr-2"/>Criar Pré‑Cadastro</Button>
              <Button className="w-full" variant="outline" onClick={() => setScheduleOpen(true)}>Agendar Visita</Button>
            </div>
          </div>
        </div>
        <ScheduleVisitDialog open={scheduleOpen} onOpenChange={setScheduleOpen} leadId={lead?.id} />
      </DialogContent>
    </Dialog>
  );
}
