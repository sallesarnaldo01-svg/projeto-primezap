import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  listCorrespondentes,
  createCorrespondente,
  deleteCorrespondente,
  listCorrespondenteUsers,
  createCorrespondenteUser,
  deleteCorrespondenteUser,
  type Correspondente,
  type CorrespondenteUser,
} from '@/services/correspondentes';
import { Trash2, Plus } from 'lucide-react';

export function CorrespondentesManager() {
  const [items, setItems] = useState<Correspondente[]>([]);
  const [usersByCorp, setUsersByCorp] = useState<Record<string, CorrespondenteUser[]>>({});
  const [form, setForm] = useState<Partial<Correspondente>>({ status: 'ATIVO' });
  const [userForm, setUserForm] = useState<Record<string, Partial<CorrespondenteUser>>>({});

  useEffect(() => {
    (async () => {
      try {
        const list = await listCorrespondentes();
        setItems(list);
        const map: Record<string, CorrespondenteUser[]> = {};
        for (const c of list) {
          map[c.id] = await listCorrespondenteUsers({ correspondenteId: c.id });
        }
        setUsersByCorp(map);
      } catch {}
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Correspondentes</h2>
        <p className="text-muted-foreground">Cadastro de empresas parceiras e seus usuários</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo Correspondente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.nome ?? ''} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input value={form.cnpj ?? ''} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} />
            </div>
            <div>
              <Label>Contato</Label>
              <Input value={form.contato ?? ''} onChange={(e) => setForm((p) => ({ ...p, contato: e.target.value }))} />
            </div>
            <div>
              <Label>E‑mail</Label>
              <Input type="email" value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <Button onClick={async () => {
              if (!form.nome || !form.cnpj) return toast.error('Informe nome e CNPJ.');
              try {
                const created = await createCorrespondente(form as any);
                setItems((prev) => [created, ...prev]);
                setForm({ status: 'ATIVO' });
              } catch {
                toast.error('Falha ao criar correspondente.');
              }
            }}>
              <Plus className="h-4 w-4 mr-2"/> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {items.map((c) => (
        <Card key={c.id}>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{c.nome} • {c.cnpj}</CardTitle>
            <Button variant="destructive" size="sm" onClick={async () => { await deleteCorrespondente({ id: c.id }); setItems((prev) => prev.filter((x) => x.id !== c.id)); }}>
              <Trash2 className="h-4 w-4"/>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Contato: {c.contato ?? '—'} • Email: {c.email ?? '—'}</div>
            <div className="mt-4">
              <div className="font-medium mb-2">Usuários</div>
              <div className="space-y-2">
                {(usersByCorp[c.id] ?? []).map((u) => (
                  <div key={u.id} className="flex items-center justify-between border rounded-md p-2">
                    <div className="text-sm">{u.nome} • {u.email} • {u.telefone ?? '—'}</div>
                    <Button variant="destructive" size="sm" onClick={async () => {
                      await deleteCorrespondenteUser({ id: u.id });
                      setUsersByCorp((prev) => ({ ...prev, [c.id]: (prev[c.id] ?? []).filter((x) => x.id !== u.id) }));
                    }}>
                      <Trash2 className="h-4 w-4"/>
                    </Button>
                  </div>
                ))}
                <div className="grid md:grid-cols-3 gap-2">
                  <Input placeholder="Nome" value={userForm[c.id]?.nome ?? ''} onChange={(e) => setUserForm((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] ?? {}), nome: e.target.value } }))} />
                  <Input placeholder="E‑mail" type="email" value={userForm[c.id]?.email ?? ''} onChange={(e) => setUserForm((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] ?? {}), email: e.target.value } }))} />
                  <div className="flex gap-2">
                    <Input placeholder="Telefone" value={userForm[c.id]?.telefone ?? ''} onChange={(e) => setUserForm((prev) => ({ ...prev, [c.id]: { ...(prev[c.id] ?? {}), telefone: e.target.value } }))} />
                    <Button size="sm" onClick={async () => {
                      const payload = userForm[c.id];
                      if (!payload?.nome || !payload?.email) return toast.error('Nome e e‑mail são obrigatórios.');
                      const created = await createCorrespondenteUser({ correspondenteId: c.id, ...payload } as any);
                      setUsersByCorp((prev) => ({ ...prev, [c.id]: [created, ...(prev[c.id] ?? [])] }));
                      setUserForm((prev) => ({ ...prev, [c.id]: {} }));
                    }}>
                      <Plus className="h-4 w-4"/>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

