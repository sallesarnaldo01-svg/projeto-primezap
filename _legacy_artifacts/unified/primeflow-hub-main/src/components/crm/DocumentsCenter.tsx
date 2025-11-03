import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Save, Trash2 } from 'lucide-react';
import { listTipos, createTipo, deleteTipo, type DocumentoTipo, type DocumentoEtapa } from '@/services/documentos';

const ETAPAS: { value: DocumentoEtapa; label: string }[] = [
  { value: 'LEAD', label: 'Lead' },
  { value: 'DEAL', label: 'Deal' },
  { value: 'PRE_CADASTRO', label: 'Pré‑Cadastro' },
];

export function DocumentsCenter() {
  const [tipos, setTipos] = useState<DocumentoTipo[]>([]);
  const [nome, setNome] = useState('');
  const [etapa, setEtapa] = useState<DocumentoEtapa>('PRE_CADASTRO');
  const [obrigatorio, setObrigatorio] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setTipos(await listTipos());
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Documentos • Configuração</h2>
        <p className="text-muted-foreground">Defina os tipos obrigatórios por etapa e entidade (Lead, Deal, Pré‑Cadastro)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Tipo de Documento</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Nome</Label>
              <Input placeholder="Ex.: RG, CPF, Comprovante de Renda" value={nome} onChange={(e) => setNome(e.target.value)} />
            </div>
            <div>
              <Label>Etapa</Label>
              <Select value={etapa} onValueChange={(v) => setEtapa(v as DocumentoEtapa)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ETAPAS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={async () => {
                if (!nome.trim()) return toast.error('Informe um nome.');
                try {
                  const created = await createTipo({ nome, etapa, obrigatorio });
                  setTipos((prev) => [created, ...prev]);
                  setNome(''); setEtapa('PRE_CADASTRO'); setObrigatorio(true);
                } catch {
                  toast.error('Falha ao salvar tipo.');
                }
              }}>
                <Plus className="h-4 w-4 mr-2"/> Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tipos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tipos.map((t) => (
              <div key={t.id} className="p-3 border rounded-md flex items-center justify-between">
                <div className="text-sm">
                  <div className="font-medium">{t.nome}</div>
                  <div className="text-muted-foreground text-xs">Etapa: {t.etapaLabel} • {t.obrigatorio ? 'Obrigatório' : 'Opcional'}</div>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={async () => { await deleteTipo({ id: t.id }); setTipos((prev) => prev.filter((x) => x.id !== t.id)); }}>
                    <Trash2 className="h-4 w-4"/>
                  </Button>
                </div>
              </div>
            ))}
            {tipos.length === 0 && (
              <div className="text-sm text-muted-foreground">Nenhum tipo cadastrado ainda.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

