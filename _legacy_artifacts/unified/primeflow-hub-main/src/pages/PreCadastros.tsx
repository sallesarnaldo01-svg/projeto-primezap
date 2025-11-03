import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, Search } from 'lucide-react';
import { listPreCadastros, createPreCadastro, PreCadastro, statusToLabel } from '@/services/preCadastros';

export default function PreCadastros() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['pre-cadastros'],
    queryFn: () => listPreCadastros(),
  });

  const items = data ?? [];

  const counters = useMemo(() => {
    const total = items.length;
    const byStatus: Record<string, number> = {};
    for (const it of items) {
      byStatus[it.status] = (byStatus[it.status] ?? 0) + 1;
    }
    return { total, byStatus };
  }, [items]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const s = search.toLowerCase();
    return items.filter((pc) =>
      (pc.empreendimento ?? '').toLowerCase().includes(s) ||
      (pc.leadName ?? '').toLowerCase().includes(s) ||
      (pc.id ?? '').toLowerCase().includes(s)
    );
  }, [items, search]);

  const handleCreate = async () => {
    try {
      const created = await createPreCadastro({});
      navigate(`/pre-cadastros/${created.id}`);
    } catch {
      // no-op: API pode ainda não estar disponível para criação
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pré‑Cadastros</h1>
          <p className="text-muted-foreground">Gestão de propostas e documentação</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()}>Atualizar</Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" /> Novo Pré‑Cadastro
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Total</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counters.total}</div>
          </CardContent>
        </Card>
        {Object.entries(counters.byStatus).map(([status, count]) => (
          <Card key={status}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{statusToLabel(status as any)}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-4">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por empreendimento, lead ou ID"
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">Empreendimento</th>
                  <th className="text-left p-3">Lead</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Criado em</th>
                  <th className="text-right p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((pc: PreCadastro) => (
                  <tr key={pc.id} className="border-b last:border-none hover:bg-muted/30">
                    <td className="p-3 font-mono text-xs">{pc.id}</td>
                    <td className="p-3">{pc.empreendimento ?? '—'}</td>
                    <td className="p-3">{pc.leadName ?? '—'}</td>
                    <td className="p-3"><Badge variant="secondary">{pc.statusLabel ?? statusToLabel(pc.status)}</Badge></td>
                    <td className="p-3">{pc.createdAt ? new Date(pc.createdAt).toLocaleDateString('pt-BR') : '—'}</td>
                    <td className="p-3 text-right">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/pre-cadastros/${pc.id}`)}>Abrir</Button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhum pré‑cadastro encontrado</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

