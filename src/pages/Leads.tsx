import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Download, Plus, UserPlus } from 'lucide-react';

type Lead = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  origin?: string | null;
  score?: number | null;
  saleProbability?: number | null;
  createdAt?: string | null;
  ownerId?: string | null;
};

export default function Leads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    origin: 'manual',
    status: 'new',
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    const searched = leads.filter((l) =>
      [l.name, l.email || '', l.phone || ''].some((v) => (v || '').toLowerCase().includes(q))
    );
    if (statusFilter === 'all') return searched;
    return searched.filter((l) => (l.status ?? 'new') === statusFilter);
  }, [leads, search, statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get<{ data: Lead[] }>(`/leads`, { limit: 100 });
      // API may return data or wrapped payload; we normalize
      const arr = Array.isArray((data as any).data) ? (data as any).data : (data as any);
      setLeads(arr as Lead[]);
    } catch (err) {
      console.error(err);
      toast.error('Falha ao carregar leads');
    } finally {
      setLoading(false);
    }
  }

  async function distribute() {
    setDistributing(true);
    try {
      await api.post(`/leads/distribute`, {});
      toast.success('Leads distribuídos');
      load();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao distribuir leads');
    } finally {
      setDistributing(false);
    }
  }

  async function createLead() {
    if (!form.name.trim()) {
      toast.error('Informe o nome do lead');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        origin: form.origin || 'manual',
        status: form.status || 'new',
      };
      await api.post<Lead>(`/leads`, payload);
      toast.success('Lead criado com sucesso');
      setDialogOpen(false);
      setForm({ name: '', email: '', phone: '', origin: 'manual', status: 'new' });
      load();
    } catch (err) {
      console.error(err);
      toast.error('Falha ao criar lead');
    } finally {
      setCreating(false);
    }
  }

  function exportCSV() {
    const rows = [
      ['Nome', 'Email', 'Telefone', 'Status', 'Origem', 'Criado Em'].join(','),
      ...filtered.map((l) =>
        [
          l.name,
          l.email ?? '',
          l.phone ?? '',
          l.status ?? 'new',
          l.origin ?? '',
          l.createdAt ? new Date(l.createdAt).toLocaleDateString('pt-BR') : '',
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${new Date().toISOString()}.csv`;
    a.click();
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Gestão de leads e distribuição por atendentes.</p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-64">
            <Label className="text-xs">Buscar</Label>
            <Input
              placeholder="Nome, email ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Label className="text-xs">Status</Label>
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
          <Button variant="outline" onClick={exportCSV} disabled={loading}>
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button variant="outline" onClick={distribute} disabled={distributing || loading}>
            <UserPlus className="mr-2 h-4 w-4" />
            {distributing ? 'Distribuindo...' : 'Distribuir'}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Lead
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {loading ? 'Carregando leads...' : `${filtered.length} lead(s)`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-md border">
            {filtered.map((l) => (
              <div key={l.id} className="grid grid-cols-12 gap-3 p-3 text-sm">
                <div className="col-span-3 font-medium truncate" title={l.name}>{l.name}</div>
                <div className="col-span-3 truncate" title={l.email || ''}>{l.email || '—'}</div>
                <div className="col-span-2 truncate" title={l.phone || ''}>{l.phone || '—'}</div>
                <div className="col-span-2">
                  <Badge variant="outline">{l.status || 'novo'}</Badge>
                </div>
                <div className="col-span-2 text-right">
                  <span className="text-muted-foreground">{(l.saleProbability ?? 0)}%</span>
                </div>
              </div>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="p-6 text-center text-muted-foreground">Nenhum lead encontrado</div>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex.: Maria Souza"
              />
            </div>
            <div className="grid gap-1 grid-cols-2">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="maria@email.com"
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+55 11 99999-9999"
                />
              </div>
            </div>
            <div className="grid gap-1 grid-cols-2">
              <div>
                <Label>Origem</Label>
                <Select value={form.origin} onValueChange={(v) => setForm((p) => ({ ...p, origin: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="site">Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Novo</SelectItem>
                    <SelectItem value="contacted">Contatado</SelectItem>
                    <SelectItem value="qualified">Qualificado</SelectItem>
                    <SelectItem value="lost">Perdido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancelar
            </Button>
            <Button onClick={createLead} disabled={creating}>
              {creating ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
