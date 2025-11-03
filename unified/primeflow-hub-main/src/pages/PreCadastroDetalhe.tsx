import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { getPreCadastro, PreCadastro, statusToLabel } from '@/services/preCadastros';

export default function PreCadastroDetalhe() {
  const navigate = useNavigate();
  const { id } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pre-cadastro', id],
    queryFn: () => getPreCadastro(id as string),
    enabled: Boolean(id),
  });

  if (isLoading) return <div className="p-6">Carregando…</div>;
  if (isError || !data) return <div className="p-6">Pré‑cadastro não encontrado</div>;

  const pc: PreCadastro = data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/pre-cadastros')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Pré‑Cadastro</h1>
          <p className="text-muted-foreground text-sm">ID: {pc.id}</p>
        </div>
        <Badge variant="secondary">{pc.statusLabel ?? statusToLabel(pc.status)}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Empreendimento" value={pc.empreendimento ?? '—'} />
          <Info label="Bloco" value={pc.bloco ?? '—'} />
          <Info label="Unidade" value={pc.unidade ?? '—'} />
          <Info label="Lead" value={pc.leadName ?? pc.leadId ?? '—'} />
          <Info label="Renda Mensal" value={moeda(pc.rendaMensal)} />
          <Info label="Prestação" value={moeda(pc.prestacaoValor)} />
          <Info label="Vencimento da aprovação" value={pc.vencimentoAprovacao ? new Date(pc.vencimentoAprovacao).toLocaleDateString('pt-BR') : '—'} />
          <Info label="Criado em" value={pc.createdAt ? new Date(pc.createdAt).toLocaleDateString('pt-BR') : '—'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Integração de documentos (upload/aprovação/ZIP/PDF) será habilitada após migrations/policies finais do Supabase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function moeda(n?: number) {
  if (typeof n !== 'number') return '—';
  return `R$ ${n.toLocaleString('pt-BR')}`;
}

