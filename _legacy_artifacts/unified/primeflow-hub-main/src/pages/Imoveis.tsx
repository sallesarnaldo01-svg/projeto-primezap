import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { propertiesService, type Property } from '@/services/properties';
import { visitsService } from '@/services/visits';
import { useToast } from '@/components/ui/use-toast';

export default function Imoveis() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [form, setForm] = useState<Partial<Property>>({ type: 'apartment', transactionType: 'sale', status: 'available' });

  const { data, isLoading } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertiesService.list(filters)
  });

  const createProperty = useMutation({
    mutationFn: (payload: Partial<Property>) => propertiesService.create(payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); setIsDialogOpen(false); toast({ title: 'Imóvel cadastrado!' }); },
    onError: () => toast({ title: 'Erro ao cadastrar', variant: 'destructive' })
  });

  const removeProperty = useMutation({
    mutationFn: (id: string) => propertiesService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['properties'] }); toast({ title: 'Imóvel removido' }); }
  });

  const generateDesc = useMutation({
    mutationFn: (id: string) => propertiesService.generateDescription(id, 'friendly'),
    onSuccess: () => toast({ title: 'Descrição gerada (IA)' }),
    onError: () => toast({ title: 'Falha ao gerar descrição', variant: 'destructive' })
  });

  const scheduleVisit = useMutation({
    mutationFn: (propertyId: string) => visitsService.create({ propertyId, scheduledAt: new Date().toISOString() }),
    onSuccess: () => toast({ title: 'Visita agendada' }),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Imóveis</h1>
          <p className="text-muted-foreground mt-1">Gerencie o catálogo de imóveis</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>Novo imóvel</Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Cadastrar Imóvel</DialogTitle>
              <DialogDescription>Preencha os campos mínimos</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => { e.preventDefault(); createProperty.mutate(form); }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Título</Label>
                  <Input value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={String(form.type)} onValueChange={(v) => setForm({ ...form, type: v as Property['type'] })}>
                    <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="apartment">Apartamento</SelectItem>
                      <SelectItem value="house">Casa</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                      <SelectItem value="land">Terreno</SelectItem>
                      <SelectItem value="farm">Chácara/Fazenda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Transação</Label>
                  <Select value={String(form.transactionType)} onValueChange={(v) => setForm({ ...form, transactionType: v as Property['transactionType'] })}>
                    <SelectTrigger><SelectValue placeholder="Transação" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">Venda</SelectItem>
                      <SelectItem value="rent">Aluguel</SelectItem>
                      <SelectItem value="both">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={String(form.status)} onValueChange={(v) => setForm({ ...form, status: v as Property['status'] })}>
                    <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Disponível</SelectItem>
                      <SelectItem value="reserved">Reservado</SelectItem>
                      <SelectItem value="sold">Vendido</SelectItem>
                      <SelectItem value="rented">Alugado</SelectItem>
                      <SelectItem value="unavailable">Indisponível</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Preço</Label>
                  <Input type="number" value={form.price ?? ''} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) })} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createProperty.isPending}>Salvar</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Imóveis</CardTitle>
          <CardDescription>Filtros simples</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input placeholder="Buscar" onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })} />
            <Select onValueChange={(v) => setFilters({ ...filters, transactionType: v === 'all' ? undefined : v })}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Transação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="sale">Venda</SelectItem>
                <SelectItem value="rent">Aluguel</SelectItem>
                <SelectItem value="both">Ambas</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(v) => setFilters({ ...filters, status: v === 'all' ? undefined : v })}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="reserved">Reservado</SelectItem>
                <SelectItem value="sold">Vendido</SelectItem>
                <SelectItem value="rented">Alugado</SelectItem>
                <SelectItem value="unavailable">Indisponível</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="divide-y">
              {(data?.data || []).map((p) => (
                <div key={p.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">{p.city} • {p.type} • {p.transactionType}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.status === 'available' ? 'default' : 'secondary'}>{p.status}</Badge>
                      <Button size="sm" variant="outline" onClick={() => scheduleVisit.mutate(p.id)}>Agendar visita</Button>
                      <Button size="sm" variant="outline" onClick={() => generateDesc.mutate(p.id)} disabled={generateDesc.isPending}>Gerar descrição</Button>
                      <Button size="sm" variant="destructive" onClick={() => removeProperty.mutate(p.id)}>Excluir</Button>
                    </div>
                  </div>
                </div>
              ))}
              {data && data.data.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum imóvel encontrado.</div>
              )}
            </div>
          )}

          <Separator className="my-4" />
          <div className="text-xs text-muted-foreground">Integração com endpoints reais: /api/properties e /api/visits</div>
        </CardContent>
      </Card>
    </div>
  );
}
