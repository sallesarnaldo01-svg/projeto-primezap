import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { messageTemplatesService, type MessageTemplate } from '@/services/messageTemplates';
import { useToast } from '@/components/ui/use-toast';

export default function Templates() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<MessageTemplate>>({ shared: false });

  const { data, isLoading } = useQuery({
    queryKey: ['message-templates', categoryFilter],
    queryFn: () => messageTemplatesService.list({ category: categoryFilter })
  });

  const create = useMutation({
    mutationFn: (payload: Partial<MessageTemplate>) => messageTemplatesService.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['message-templates'] }); setOpen(false); toast({ title: 'Template criado!' }); },
    onError: () => toast({ title: 'Erro ao criar', variant: 'destructive' })
  });

  const remove = useMutation({
    mutationFn: (id: string) => messageTemplatesService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['message-templates'] }); toast({ title: 'Template excluído' }); },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates</h1>
          <p className="text-muted-foreground mt-1">Crie e gerencie seus modelos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Novo template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Novo Template</DialogTitle>
              <DialogDescription>Variáveis no formato {{nome}}</DialogDescription>
            </DialogHeader>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate(form); }}>
              <div>
                <Label>Nome</Label>
                <Input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input value={form.category || ''} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea value={form.content || ''} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={6} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={create.isPending}>Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>Seus templates e compartilhados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Select onValueChange={(v) => setCategoryFilter(v === 'all' ? undefined : v)}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="saudacao">Saudação</SelectItem>
                <SelectItem value="propostas">Propostas</SelectItem>
                <SelectItem value="followup">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="space-y-3">
              {(data?.data || []).map((t) => (
                <div key={t.id} className="p-3 border rounded-md">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">{t.category || 'sem categoria'}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(t.content)}>Copiar</Button>
                      <Button variant="destructive" size="sm" onClick={() => remove.mutate(t.id)}>Excluir</Button>
                    </div>
                  </div>
                  <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">{t.content}</pre>
                </div>
              ))}
              {data && data.data.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum template encontrado.</div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
