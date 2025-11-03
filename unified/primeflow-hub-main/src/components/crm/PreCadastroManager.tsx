import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Calendar, FileText, Filter, Link2, Plus, Sparkles, Upload, UserCheck } from 'lucide-react';
import SimuladorFinanciamento from '@/components/SimuladorFinanciamento';
import {
  listPreCadastros,
  createPreCadastro,
  getPreCadastro,
  type PreCadastro,
  type PreCadastroStatus,
  calcDocsProgress,
} from '@/services/preCadastros';
import { uploadDocumento, listDocumentos, approveDocumento, rejectDocumento, downloadZip } from '@/services/documentos';
import { listCorrespondentes, type Correspondente, assignCorrespondente } from '@/services/correspondentes';
import { supabase } from '@/integrations/supabase/client';

const STATUS_OPTIONS: { value: PreCadastroStatus; label: string }[] = [
  { value: 'NOVA_AVALIACAO', label: 'Nova Avaliação' },
  { value: 'APROVADO', label: 'Aprovado' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ANALISE', label: 'Em Análise' },
  { value: 'REJEITADO', label: 'Rejeitado' },
];

export function PreCadastroManager() {
  const [items, setItems] = useState<PreCadastro[]>([]);
  const [statusFilter, setStatusFilter] = useState<'ALL' | PreCadastroStatus>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await listPreCadastros();
        setItems(res);
      } catch (e) {
        // fallback: keep empty and show hint
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const matchesStatus = statusFilter === 'ALL' ? true : i.status === statusFilter;
      const hay = `${i.empreendimento ?? ''} ${i.unidade ?? ''} ${i.bloco ?? ''} ${i.leadName ?? ''}`.toLowerCase();
      const matchesSearch = hay.includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, statusFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Pré‑Cadastros</h2>
          <p className="text-muted-foreground">Gestão de pré‑cadastros de financiamento/crédito</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo Pré‑Cadastro
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Pré‑Cadastro</DialogTitle>
            </DialogHeader>
            <CreatePreCadastroForm
              onCancel={() => setIsCreateOpen(false)}
              onSubmit={async (payload) => {
                try {
                  const created = await createPreCadastro(payload);
                  setItems((prev) => [created, ...prev]);
                  setIsCreateOpen(false);
                  toast.success('Pré‑Cadastro criado!');
                } catch (e) {
                  toast.error('Falha ao criar pré‑cadastro.');
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="sr-only">Buscar</Label>
              <Input placeholder="Buscar por empreendimento, unidade, lead…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os status</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline"><Filter className="h-4 w-4 mr-2"/>Filtros Avançados</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((pc) => (
          <Card key={pc.id} className="hover:shadow-md cursor-pointer" onClick={() => setSelectedId(pc.id)}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{pc.empreendimento ?? '—'} {pc.bloco && `• ${pc.bloco}`} {pc.unidade && `• ${pc.unidade}`}</CardTitle>
                <Badge variant="outline">{pc.statusLabel}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground space-y-1">
                <div>Lead: <span className="text-foreground">{pc.leadName ?? '—'}</span></div>
                <div>Renda mensal: <span className="text-foreground">{pc.rendaMensal ? `R$ ${pc.rendaMensal.toLocaleString('pt-BR')}` : '—'}</span></div>
                <div>Prestação: <span className="text-foreground">{pc.prestacaoValor ? `R$ ${pc.prestacaoValor.toLocaleString('pt-BR')}` : '—'}</span></div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4"/>
                  <span>Documentos: {calcDocsProgress(pc)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4"/>
                  <span>Vencimento aprovação: {pc.vencimentoAprovacao ? new Date(pc.vencimentoAprovacao).toLocaleDateString('pt-BR') : '—'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedId && (
        <PreCadastroDetail id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}

function CreatePreCadastroForm({ onCancel, onSubmit }: { onCancel: () => void; onSubmit: (payload: Partial<PreCadastro>) => void }) {
  const [form, setForm] = useState<Partial<PreCadastro>>({ status: 'NOVA_AVALIACAO' });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Lead (ID ou nome)</Label>
          <Input value={form.leadId ?? ''} onChange={(e) => setForm((p) => ({ ...p, leadId: e.target.value }))} placeholder="ID ou nome do lead" />
        </div>
        <div>
          <Label>Empreendimento</Label>
          <Input value={form.empreendimento ?? ''} onChange={(e) => setForm((p) => ({ ...p, empreendimento: e.target.value }))} />
        </div>
        <div>
          <Label>Bloco</Label>
          <Input value={form.bloco ?? ''} onChange={(e) => setForm((p) => ({ ...p, bloco: e.target.value }))} />
        </div>
        <div>
          <Label>Unidade</Label>
          <Input value={form.unidade ?? ''} onChange={(e) => setForm((p) => ({ ...p, unidade: e.target.value }))} />
        </div>
        <div>
          <Label>Renda Mensal</Label>
          <Input type="number" value={form.rendaMensal ?? ''} onChange={(e) => setForm((p) => ({ ...p, rendaMensal: Number(e.target.value) }))} />
        </div>
        <div>
          <Label>Prestação (R$)</Label>
          <Input type="number" value={form.prestacaoValor ?? ''} onChange={(e) => setForm((p) => ({ ...p, prestacaoValor: Number(e.target.value) }))} />
        </div>
      </div>
      <div>
        <Label>Observações</Label>
        <Textarea value={form.observacoes ?? ''} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSubmit(form)}>Criar</Button>
      </div>
    </div>
  );
}

function PreCadastroDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<PreCadastro | null>(null);
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof listDocumentos>>>([]);
  const [correspondentes, setCorrespondentes] = useState<Correspondente[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await getPreCadastro(id);
        setData(d);
      } catch {}
      try {
        const l = await listDocumentos({ preCadastroId: id });
        setDocs(l);
      } catch {}
      try {
        const c = await listCorrespondentes();
        setCorrespondentes(c);
      } catch {}
    })();
  }, [id]);

  if (!data) return null;

  const progress = typeof (data as any).percentualDocumentos === 'number' ? (data as any).percentualDocumentos : calcDocsProgress(data, docs);

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <CardTitle>Pré‑Cadastro • {data.empreendimento ?? '—'} {data.bloco && `• ${data.bloco}`} {data.unidade && `• ${data.unidade}`}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{data.statusLabel}</Badge>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Lead: {data.leadName ?? '—'} • Correspondente: {data.correspondenteName ?? '—'}</p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="info">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="docs">Documentos ({progress}%)</TabsTrigger>
            <TabsTrigger value="agenda">Agendar</TabsTrigger>
            <TabsTrigger value="corresp">Correspondente</TabsTrigger>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="simulacao">Simulação</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <div className="grid md:grid-cols-3 gap-4 mt-4 text-sm">
              <Info item label="Cadastro" value={data.createdAt ? new Date(data.createdAt).toLocaleString('pt-BR') : '—'} />
              <Info item label="Vencimento da aprovação" value={data.vencimentoAprovacao ? new Date(data.vencimentoAprovacao).toLocaleDateString('pt-BR') : '—'} />
              <Info item label="Prazo (meses)" value={data.prazoMeses?.toString() ?? '—'} />
              <Info money label="Avaliação" value={data.avaliacaoValor} />
              <Info money label="Aprovado" value={data.aprovadoValor} />
              <Info money label="Subsídio" value={data.subsidioValor} />
              <Info money label="FGTS" value={data.fgtsValor} />
              <Info money label="Prestação" value={data.prestacaoValor} />
              <Info money label="Renda Mensal" value={data.rendaMensal} />
              <Info money label="Renda Familiar" value={data.rendaFamiliar} />
            </div>
          </TabsContent>

          <TabsContent value="docs" className="mt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">Progresso de documentação: {progress}%</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    await downloadZip({ preCadastroId: id });
                  } catch {
                    toast.error('Falha ao gerar download.');
                  }
                }}>Baixar tudo (ZIP/PDF)</Button>
                <Button variant="outline" size="sm" onClick={async () => {
                  try { await (await import('@/services/documentos')).downloadPdf({ preCadastroId: id }); }
                  catch { toast.error('Falha ao gerar PDF.'); }
                }}>Baixar PDF Único</Button>
                <Button size="sm" onClick={() => document.getElementById('fileInput')?.click()}>
                  <Upload className="h-4 w-4 mr-2"/> Upload Documento
                </Button>
                <input id="fileInput" type="file" className="hidden" onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setUploading(true);
                  try {
                    await uploadDocumento({ preCadastroId: id, file: f });
                    const l = await listDocumentos({ preCadastroId: id });
                    setDocs(l);
                    toast.success('Documento enviado.');
                  } catch {
                    toast.error('Falha no upload.');
                  } finally {
                    setUploading(false);
                    e.currentTarget.value = '';
                  }
                }} />
              </div>
            </div>
            <div className="grid gap-3">
              {docs.map((d) => (
                <div key={d.id} className="p-3 border rounded-md flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="font-medium text-sm">{d.tipoLabel} • {d.pessoa ?? '—'}</div>
                    <div className="text-xs text-muted-foreground">{d.statusLabel} • {new Date(d.uploadedAt).toLocaleString('pt-BR')}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => window.open(d.url, '_blank')}>Download</Button>
                    <Button variant="secondary" size="sm" onClick={async () => { await approveDocumento({ id: d.id }); setDocs(await listDocumentos({ preCadastroId: id })); }}>Aprovar</Button>
                    <Button variant="destructive" size="sm" onClick={async () => { await rejectDocumento({ id: d.id }); setDocs(await listDocumentos({ preCadastroId: id })); }}>Rejeitar</Button>
                  </div>
                </div>
              ))}
              {docs.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum documento enviado ainda.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="mt-4">
            <ScheduleForm preCadastroId={id} />
          </TabsContent>

          <TabsContent value="corresp" className="mt-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>Selecionar Correspondente</Label>
                <Select onValueChange={async (v) => {
                  await assignCorrespondente({ preCadastroId: id, correspondenteId: v });
                  toast.success('Correspondente atribuído.');
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha um correspondente" />
                  </SelectTrigger>
                  <SelectContent>
                    {correspondentes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome} • {c.cnpj}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button variant="outline"><UserCheck className="h-4 w-4 mr-2"/>Atribuir usuário específico</Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="leads" className="mt-4">
            <div className="text-sm text-muted-foreground">Lead vinculado: {data.leadName ?? '—'} (ID: {data.leadId ?? '—'})</div>
            <div className="mt-2 flex gap-2">
              <Button variant="outline"><Link2 className="h-4 w-4 mr-2"/>Vincular outro lead</Button>
              <Button variant="secondary"><Sparkles className="h-4 w-4 mr-2"/>Criar a partir do lead</Button>
            </div>
          </TabsContent>

          <TabsContent value="simulacao" className="mt-4">
            <SimuladorFinanciamento preCadastroId={id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function Info({ label, value, money }: { label: string; value?: string | number | null; money?: boolean; item?: any }) {
  const v = value == null || value === '' ? '—' : money && typeof value === 'number' ? `R$ ${value.toLocaleString('pt-BR')}` : String(value);
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{v}</div>
    </div>
  );
}

function ScheduleForm({ preCadastroId }: { preCadastroId: string }) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  return (
    <div className="grid md:grid-cols-3 gap-4">
      <div>
        <Label>Data</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Hora</Label>
        <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </div>
      <div className="md:col-span-3">
        <Label>Observações</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="md:col-span-3 flex justify-end">
        <Button onClick={() => toast.success('Agendamento solicitado (placeholder).')}>Salvar e Enviar Confirmação</Button>
      </div>
    </div>
  );
}
