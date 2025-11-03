import { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { BulkAIDialog } from '@/components/crm/BulkAIDialog';
import { Plus, Search, Filter, Phone, Mail, Edit, Trash2, Sparkles } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCorners } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useDeals,
  usePipeline,
  useCreateDeal,
  useUpdateDeal,
  useUpdateDealStage,
  useDeleteDeal,
} from '@/hooks/useCRM';
import type { Deal, DealStage } from '@/services/crm';
import { toast } from 'sonner';
import { listPreCadastros } from '@/services/preCadastros';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    const maybeMessage = (error as { message?: string }).message;
    return maybeMessage ?? fallback;
  }

  return fallback;
};

const PIPELINE_STAGES: Array<{
  id: DealStage;
  name: string;
  color: string;
  textColor: string;
}> = [
  { id: 'LEAD', name: 'Leads', color: 'bg-gray-100', textColor: 'text-gray-700' },
  { id: 'QUALIFIED', name: 'Qualificação', color: 'bg-blue-100', textColor: 'text-blue-700' },
  { id: 'PROPOSAL', name: 'Proposta', color: 'bg-yellow-100', textColor: 'text-yellow-700' },
  { id: 'NEGOTIATION', name: 'Negociação', color: 'bg-orange-100', textColor: 'text-orange-700' },
  { id: 'CLOSED_WON', name: 'Fechado (Ganho)', color: 'bg-green-100', textColor: 'text-green-700' },
  { id: 'CLOSED_LOST', name: 'Fechado (Perdido)', color: 'bg-red-100', textColor: 'text-red-700' },
];

type UIDeal = {
  id: string;
  title: string;
  company: string;
  contactName: string;
  contactId?: string;
  email?: string;
  phone?: string;
  value: number;
  stage: DealStage;
  probability: number;
  owner: string;
  lastInteraction: string;
  tags: string[];
  description?: string | null;
  contactAvatar?: string;
  assigneeAvatar?: string;
  preCadastroStatus?: string;
};

const STAGE_PROBABILITY: Record<DealStage, number> = {
  LEAD: 10,
  QUALIFIED: 30,
  PROPOSAL: 50,
  NEGOTIATION: 70,
  CLOSED_WON: 100,
  CLOSED_LOST: 0,
};

const FALLBACK_DEALS: UIDeal[] = [
  {
    id: 'deal-1',
    title: 'Plano Empresarial',
    company: 'TechCorp Solutions',
    contactName: 'Carlos Silva',
    email: 'carlos@techcorp.com',
    phone: '+55 11 99999-9999',
    value: 25000,
    stage: 'PROPOSAL',
    probability: 75,
    owner: 'Maria Silva',
    lastInteraction: '2024-01-15T12:00:00Z',
    tags: ['Enterprise', 'Hot'],
    description: 'Interessados em solução completa de CRM para 50 usuários.',
  },
  {
    id: 'deal-2',
    title: 'Plano Scale-up',
    company: 'StartupXYZ',
    contactName: 'Ana Santos',
    email: 'ana@startupxyz.com',
    phone: '+55 21 88888-8888',
    value: 12500,
    stage: 'NEGOTIATION',
    probability: 60,
    owner: 'João Santos',
    lastInteraction: '2024-01-14T12:00:00Z',
    tags: ['Startup', 'SaaS'],
    description: 'Startup em crescimento buscando ferramenta de automação.',
  },
  {
    id: 'deal-3',
    title: 'Plano SMB',
    company: 'Empresa ABC',
    contactName: 'Pedro Costa',
    email: 'pedro@empresaabc.com',
    phone: '+55 31 77777-7777',
    value: 8300,
    stage: 'QUALIFIED',
    probability: 40,
    owner: 'Ana Costa',
    lastInteraction: '2024-01-13T12:00:00Z',
    tags: ['SMB'],
    description: 'Empresa familiar interessada em digitalizar processos.',
  },
  {
    id: 'deal-4',
    title: 'Plano Enterprise',
    company: 'MegaCorp Industries',
    contactName: 'Julia Oliveira',
    email: 'julia@megacorp.com',
    phone: '+55 11 55555-5555',
    value: 45000,
    stage: 'LEAD',
    probability: 25,
    owner: 'Pedro Lima',
    lastInteraction: '2024-01-16T12:00:00Z',
    tags: ['Enterprise', 'Cold'],
    description: 'Grande corporação avaliando mudança de fornecedor.',
  },
];

const mapDealFromApi = (deal: Deal): UIDeal => ({
  id: deal.id,
  title: deal.title,
  company: deal.contact?.name ?? deal.title ?? '—',
  contactName: deal.contact?.name ?? '—',
  contactId: (deal as any).contact?.id,
  email: deal.contact?.email ?? undefined,
  phone: deal.contact?.phone ?? undefined,
  value: deal.value ?? 0,
  stage: deal.stage ?? 'LEAD',
  probability: STAGE_PROBABILITY[deal.stage ?? 'LEAD'] ?? 0,
  owner: deal.assignedTo?.name ?? 'Não atribuído',
  lastInteraction: deal.updatedAt ?? deal.createdAt,
  tags: deal.contact?._count?.deals ? ['Cliente'] : [],
  description: deal.notes ?? '',
  contactAvatar: deal.contact?.avatar,
  assigneeAvatar: deal.assignedTo?.avatar,
});

const formatDate = (iso: string) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
};

function DealCard({
  deal,
  onEdit,
  isSelected,
  onSelectChange,
}: {
  deal: UIDeal;
  onEdit: (deal: UIDeal) => void;
  isSelected: boolean;
  onSelectChange: (id: string, selected: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="p-4 bg-card border rounded-lg cursor-grab hover:shadow-md transition-all"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelectChange(deal.id, Boolean(checked))}
            onClick={(e) => e.stopPropagation()}
          />
          <span className="text-xs text-muted-foreground">Selecionar para ação em massa</span>
        </div>

        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h4 className="font-semibold text-sm line-clamp-1">{deal.company}</h4>
            <p className="text-xs text-muted-foreground">{deal.contactName}</p>
            {deal.email && <p className="text-xs text-muted-foreground">{deal.email}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold text-primary text-sm">
              R$ {deal.value.toLocaleString('pt-BR')}
            </p>
            <p className="text-xs text-muted-foreground">{deal.probability}%</p>
          </div>
        </div>

        {deal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {deal.tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {/* Pre-Cadastro status badge if available */}
            {deal.contactId && preCadastroByLead[deal.contactId] && (
              <Badge variant="secondary" className="text-xs">
                Pré‑Cadastro: {preCadastroByLead[deal.contactId]}
              </Badge>
            )}
          </div>
        )}

        {deal.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{deal.description}</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Avatar className="h-6 w-6">
              {deal.assigneeAvatar ? (
                <AvatarImage src={deal.assigneeAvatar} />
              ) : (
                <AvatarFallback className="text-xs">
                  {deal.owner
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')}
                </AvatarFallback>
              )}
            </Avatar>
            <span className="text-xs text-muted-foreground">{deal.owner}</span>
          </div>
          <div className="flex space-x-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Phone className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <Mail className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={(e) => {
                e.stopPropagation();
                import('@/services/preCadastros').then(async ({ createPreCadastro }) => {
                  try {
                    const created = await createPreCadastro({
                      leadId: deal.id,
                      empreendimento: deal.company,
                      observacoes: deal.description ?? undefined,
                    });
                    toast.success('Pré‑Cadastro criado');
                  } catch (err) {
                    toast.error('Falha ao criar Pré‑Cadastro');
                  }
                });
              }}
            >
              Pré‑Cadastro
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(deal);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground border-t pt-2">
          Último contato: {formatDate(deal.lastInteraction)}
        </div>
      </div>
    </motion.div>
  );
}

function DealsPipeline() {
  const dealsQuery = useDeals();
  const pipelineQuery = usePipeline();
  const createDealMutation = useCreateDeal();
  const updateDealMutation = useUpdateDeal();
  const updateDealStageMutation = useUpdateDealStage();
  const deleteDealMutation = useDeleteDeal();

  const [deals, setDeals] = useState<UIDeal[]>(FALLBACK_DEALS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOwner, setSelectedOwner] = useState('all');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingDeal, setEditingDeal] = useState<UIDeal | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDeals, setSelectedDeals] = useState<string[]>([]);
  const [isBulkAIDialogOpen, setIsBulkAIDialogOpen] = useState(false);
  const [preCadastroByLead, setPreCadastroByLead] = useState<Record<string, string>>({});

  const isFallback = dealsQuery.isError || pipelineQuery.isError;

  useEffect(() => {
    if (pipelineQuery.data && !isFallback) {
      const mapped = PIPELINE_STAGES.flatMap((stage) => {
        const stageDeals = pipelineQuery.data?.[stage.id] ?? [];
        return stageDeals.map(mapDealFromApi);
      });
      if (mapped.length > 0) {
        setDeals(mapped);
      }
    } else if (dealsQuery.data && !isFallback) {
      const mapped = dealsQuery.data.data.map(mapDealFromApi);
      if (mapped.length > 0) {
        setDeals(mapped);
      }
    }
  }, [dealsQuery.data, pipelineQuery.data, isFallback]);

  useEffect(() => {
    // load pre-cadastro status for visible deals (by contact id)
    (async () => {
      const leadIds = Array.from(new Set(deals.map((d) => d.contactId).filter(Boolean))) as string[];
      const map: Record<string, string> = {};
      for (const leadId of leadIds) {
        if (!leadId || typeof leadId !== 'string') continue;
        try {
          const pcs = await listPreCadastros({ leadId });
          if (pcs.length > 0) {
            map[leadId] = pcs[0].statusLabel ?? pcs[0].status;
          }
        } catch {}
      }
      setPreCadastroByLead(map);
    })();
  }, [deals]);

  const handleSelectDeal = (dealId: string, selected: boolean) => {
    setSelectedDeals((prev) => (selected ? [...prev, dealId] : prev.filter((id) => id !== dealId)));
  };

  const handleSelectAll = (selected: boolean) => {
    setSelectedDeals(selected ? filteredDeals.map((d) => d.id) : []);
  };

  const handleBulkAIComplete = () => {
    setSelectedDeals([]);
  };

  const filteredDeals = useMemo(() => {
    return deals.filter((deal) => {
      const matchesSearch =
        deal.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
        deal.contactName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (deal.email ?? '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchesOwner =
        selectedOwner === 'all' || deal.owner.toLowerCase().includes(selectedOwner.toLowerCase());

      return matchesSearch && matchesOwner;
    });
  }, [deals, searchTerm, selectedOwner]);

  const dealsByStage = useMemo(() => {
    return PIPELINE_STAGES.reduce<Record<DealStage, UIDeal[]>>((acc, stage) => {
      acc[stage.id] = filteredDeals.filter((deal) => deal.stage === stage.id);
      return acc;
    }, {
      LEAD: [],
      QUALIFIED: [],
      PROPOSAL: [],
      NEGOTIATION: [],
      CLOSED_WON: [],
      CLOSED_LOST: [],
    });
  }, [filteredDeals]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const targetStage = PIPELINE_STAGES.find((stage) => stage.id === over.id);
    if (!targetStage) return;

    const activeDealId = active.id as string;
    setDeals((prev) =>
      prev.map((deal) => (deal.id === activeDealId ? { ...deal, stage: targetStage.id } : deal)),
    );

    if (!isFallback) {
      updateDealStageMutation.mutate({ id: activeDealId, stage: targetStage.id });
    }

    setActiveId(null);
  };

  const totalValue = filteredDeals.reduce((sum, deal) => sum + deal.value, 0);
  const avgProbability = filteredDeals.length
    ? filteredDeals.reduce((sum, deal) => sum + deal.probability, 0) / filteredDeals.length
    : 0;

  const owners = useMemo(() => {
    const unique = new Set(deals.map((deal) => deal.owner));
    return Array.from(unique);
  }, [deals]);

  const activeDeal = activeId ? deals.find((deal) => deal.id === activeId) : null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">CRM / Pipeline de Vendas</h1>
            <p className="text-muted-foreground">Gerencie seu pipeline de vendas com kanban interativo</p>
          </div>
          <div className="flex items-center space-x-2">
            {selectedDeals.length > 0 && (
              <Button variant="secondary" onClick={() => setIsBulkAIDialogOpen(true)}>
                <Sparkles className="mr-2 h-4 w-4" />
                Ação em Massa com IA ({selectedDeals.length})
              </Button>
            )}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Deal
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Deal</DialogTitle>
                </DialogHeader>
                <DealForm
                  onCancel={() => setIsCreateDialogOpen(false)}
                  onSubmit={async (payload) => {
                    if (isFallback) {
                      const newDeal: UIDeal = {
                        id: `deal-${Date.now()}`,
                        title: payload.title,
                        company: payload.company,
                        contactName: payload.contactName,
                        email: payload.email,
                        phone: payload.phone,
                        value: Number(payload.value) || 0,
                        stage: 'LEAD',
                        probability: STAGE_PROBABILITY.LEAD,
                        owner: payload.owner,
                        lastInteraction: new Date().toISOString(),
                        tags: [],
                        description: payload.description,
                      };
                      setDeals((prev) => [newDeal, ...prev]);
                      toast.success('Deal criado localmente.');
                    } else {
                      try {
                        const result = await createDealMutation.mutateAsync({
                          title: payload.title,
                          contactId: payload.contactId,
                          value: Number(payload.value) || 0,
                          stage: 'LEAD',
                          notes: payload.description,
                        });
                        setDeals((prev) => [mapDealFromApi(result), ...prev]);
                        toast.success('Deal criado com sucesso!');
                      } catch (error) {
                        toast.error(
                          getErrorMessage(error, 'Não foi possível criar o deal.')
                        );
                        return;
                      }
                    }
                    setIsCreateDialogOpen(false);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Total de Deals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredDeals.length}</div>
              <p className="text-xs text-muted-foreground">Deals ativos no funil</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Valor Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">R$ {totalValue.toLocaleString('pt-BR')}</div>
              <p className="text-xs text-muted-foreground">Soma de todos os deals</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Probabilidade Média</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgProbability.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">Baseado no estágio do funil</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Deals Selecionados</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedDeals.length}</div>
              <p className="text-xs text-muted-foreground">Prontos para ações em massa</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros e Busca</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por empresa, contato ou e-mail"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os responsáveis</SelectItem>
                  {owners.map((owner) => (
                    <SelectItem key={owner} value={owner}>
                      {owner}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filtros Avançados
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="kanban">
          <TabsList>
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          <TabsContent value="kanban" className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <Checkbox
                  checked={selectedDeals.length > 0 && selectedDeals.length === filteredDeals.length}
                  onCheckedChange={(checked) => handleSelectAll(Boolean(checked))}
                  className="mr-2"
                />
                Selecionar todos ({filteredDeals.length})
              </div>
            </div>

            <DndContext
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {PIPELINE_STAGES.map((stage) => (
                  <Card key={stage.id} id={stage.id} className="border-dashed border-muted-foreground/30">
                    <CardHeader className="space-y-0 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${stage.color} ${stage.textColor}`}>
                              {stage.name}
                            </span>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            {dealsByStage[stage.id].length} deals neste estágio
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          R$
                          {dealsByStage[stage.id]
                            .reduce((sum, deal) => sum + deal.value, 0)
                            .toLocaleString('pt-BR')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <SortableContext items={dealsByStage[stage.id].map((deal) => deal.id)} strategy={verticalListSortingStrategy}>
                        {dealsByStage[stage.id].map((deal) => (
                          <DealCard
                            key={deal.id}
                            deal={deal}
                            onEdit={setEditingDeal}
                            isSelected={selectedDeals.includes(deal.id)}
                            onSelectChange={handleSelectDeal}
                          />
                        ))}
                      </SortableContext>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <DragOverlay>
                {activeDeal ? (
                  <motion.div className="p-4 bg-card border rounded-lg shadow-lg w-[280px]">
                    <div className="font-semibold">{activeDeal.company}</div>
                    <div className="text-xs text-muted-foreground">{activeDeal.contactName}</div>
                    <div className="text-xs text-muted-foreground">
                      R$ {activeDeal.value.toLocaleString('pt-BR')}
                    </div>
                  </motion.div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </TabsContent>

          <TabsContent value="lista">
            <Card>
              <CardHeader>
                <CardTitle>Lista de Deals</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Visualização em tabela para análises detalhadas
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="border-b">
                        <th className="py-2">Empresa</th>
                        <th className="py-2">Contato</th>
                        <th className="py-2">Valor</th>
                        <th className="py-2">Estágio</th>
                        <th className="py-2">Responsável</th>
                        <th className="py-2">Último Contato</th>
                        <th className="py-2 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDeals.map((deal) => (
                        <tr key={deal.id} className="border-b last:border-none">
                          <td className="py-2">
                            <div className="font-medium">{deal.company}</div>
                            <div className="text-xs text-muted-foreground">{deal.title}</div>
                          </td>
                          <td className="py-2 text-muted-foreground">{deal.contactName}</td>
                          <td className="py-2">
                            R$ {deal.value.toLocaleString('pt-BR')}
                          </td>
                          <td className="py-2">
                            <Badge variant="secondary" className="text-xs">
                              {PIPELINE_STAGES.find((stage) => stage.id === deal.stage)?.name ?? deal.stage}
                            </Badge>
                          </td>
                          <td className="py-2 text-muted-foreground">{deal.owner}</td>
                          <td className="py-2 text-muted-foreground">{formatDate(deal.lastInteraction)}</td>
                          <td className="py-2 text-right space-x-2">
                            <Button variant="ghost" size="icon" onClick={() => setEditingDeal(deal)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                if (isFallback) {
                                  setDeals((prev) => prev.filter((item) => item.id !== deal.id));
                                  toast.success('Deal removido localmente.');
                                } else {
                                  await deleteDealMutation.mutateAsync(deal.id);
                                  setDeals((prev) => prev.filter((item) => item.id !== deal.id));
                                  toast.success('Deal removido com sucesso.');
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relatorios">
            <Card>
              <CardHeader>
                <CardTitle>Relatórios do Pipeline</CardTitle>
                <p className="text-sm text-muted-foreground">Visão geral do funil com as métricas mais recentes</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  {PIPELINE_STAGES.map((stage) => {
                    const stageDeals = dealsByStage[stage.id];
                    const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0);
                    return (
                      <Card key={stage.id} className="bg-muted/40">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">{stage.name}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-1">
                          <div className="text-2xl font-semibold">{stageDeals.length} deals</div>
                          <div className="text-xs text-muted-foreground">
                            Valor: R$ {stageValue.toLocaleString('pt-BR')}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      <BulkAIDialog
        open={isBulkAIDialogOpen}
        onOpenChange={setIsBulkAIDialogOpen}
        selectedDeals={selectedDeals}
        onCompleted={handleBulkAIComplete}
      />

      {editingDeal && (
        <EditDealDrawer
          deal={editingDeal}
          onClose={() => setEditingDeal(null)}
          onSave={async (updated) => {
            if (isFallback) {
              setDeals((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              toast.success('Deal atualizado localmente.');
            } else {
              try {
                const result = await updateDealMutation.mutateAsync({
                  id: updated.id,
                  data: {
                    title: updated.title,
                    stage: updated.stage,
                    value: updated.value,
                    notes: updated.description ?? undefined,
                  },
                });
                setDeals((prev) =>
                  prev.map((item) => (item.id === updated.id ? mapDealFromApi(result) : item)),
                );
                toast.success('Deal atualizado com sucesso!');
              } catch (error) {
                toast.error(getErrorMessage(error, 'Não foi possível atualizar o deal.'));
                return;
              }
            }
            setEditingDeal(null);
          }}
        />
      )}
    </>
  );
}

// Lazy-embedded pages to consolidate CRM in a single hub
const LeadsPage = lazy(() => import('./Leads'));
const AgendamentosPage = lazy(() => import('./Agendamentos'));
const RelatoriosPage = lazy(() => import('./Relatórios'));
const CamposCustomizadosPage = lazy(() => import('./CamposCustomizados'));

// CRM submodules (new UIs)
import { PreCadastroManager } from '@/components/crm/PreCadastroManager';
import { DocumentsCenter } from '@/components/crm/DocumentsCenter';
import { CorrespondentesManager } from '@/components/crm/CorrespondentesManager';

export default function CRM() {
  const [activeTab, setActiveTab] = useState<string>('deals');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CRM</h1>
        <p className="text-muted-foreground">Central do CRM: Leads, Pré‑Cadastro, Vendas, Documentos, Agendamentos, Correspondentes e Relatórios</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="pre-cadastro">Pré‑Cadastro</TabsTrigger>
          <TabsTrigger value="deals">Vendas</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
          <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
          <TabsTrigger value="correspondentes">Correspondentes</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          <TabsTrigger value="campos">Configurar Campos</TabsTrigger>
        </TabsList>

        <TabsContent value="leads">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando Leads…</div>}>
            <LeadsPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="pre-cadastro">
          <PreCadastroManager />
        </TabsContent>

        <TabsContent value="deals">
          <DealsPipeline />
        </TabsContent>

        <TabsContent value="documentos">
          <DocumentsCenter />
        </TabsContent>

        <TabsContent value="agendamentos">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando Agendamentos…</div>}>
            <AgendamentosPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="correspondentes">
          <CorrespondentesManager />
        </TabsContent>

        <TabsContent value="relatorios">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando Relatórios…</div>}>
            <RelatoriosPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="campos">
          <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Carregando Configurações…</div>}>
            <CamposCustomizadosPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type DealFormData = {
  title: string;
  company: string;
  contactName: string;
  contactId: string;
  email?: string;
  phone?: string;
  value?: string;
  owner: string;
  description?: string;
};

function DealForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (payload: DealFormData) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [formState, setFormState] = useState<DealFormData>({
    title: '',
    company: '',
    contactName: '',
    contactId: '',
    email: '',
    phone: '',
    value: '',
    owner: '',
    description: '',
  });

  const handleChange = (field: keyof DealFormData, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            placeholder="Nome do deal"
            value={formState.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="company">Empresa</Label>
          <Input
            id="company"
            placeholder="Nome da empresa"
            value={formState.company}
            onChange={(e) => handleChange('company', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="contactName">Contato</Label>
          <Input
            id="contactName"
            placeholder="Nome do contato"
            value={formState.contactName}
            onChange={(e) => handleChange('contactName', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="contactId">ID do Contato</Label>
          <Input
            id="contactId"
            placeholder="ID do contato"
            value={formState.contactId}
            onChange={(e) => handleChange('contactId', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@empresa.com"
            value={formState.email}
            onChange={(e) => handleChange('email', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            placeholder="+55 11 99999-9999"
            value={formState.phone}
            onChange={(e) => handleChange('phone', e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="value">Valor</Label>
          <Input
            id="value"
            type="number"
            placeholder="25000"
            value={formState.value}
            onChange={(e) => handleChange('value', e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="owner">Responsável</Label>
          <Input
            id="owner"
            placeholder="Nome do responsável"
            value={formState.owner}
            onChange={(e) => handleChange('owner', e.target.value)}
          />
        </div>
      </div>
      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          placeholder="Descreva o deal..."
          value={formState.description}
          onChange={(e) => handleChange('description', e.target.value)}
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={() => onSubmit(formState)}>Criar Deal</Button>
      </div>
    </div>
  );
}

function EditDealDrawer({
  deal,
  onClose,
  onSave,
}: {
  deal: UIDeal;
  onClose: () => void;
  onSave: (deal: UIDeal) => void;
}) {
  const [formState, setFormState] = useState<UIDeal>(deal);
  const [docsCount, setDocsCount] = useState<number>(0);
  const [recent, setRecent] = useState<Array<{ id: string; type: string; content?: string; created_at: string }>>([]);
  const [docs, setDocs] = useState<Array<{ id: string; tipo?: string; pessoa?: string; url: string; uploadedAt: string }>>([]);
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    setFormState(deal);
  }, [deal]);

  const handleChange = <K extends keyof UIDeal>(field: K, value: UIDeal[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    (async () => {
      try {
        const { listDocumentos } = await import('@/services/documentos');
        const d = await listDocumentos({ dealId: deal.id });
        setDocs(d.map((x) => ({ id: x.id, tipo: (x as any).tipoLabel ?? x.tipo, pessoa: x.pessoa, url: x.url, uploadedAt: x.uploadedAt })) as any);
        setDocsCount(d.length);
      } catch {}
      try {
        const { api } = await import('@/services/api');
        const res = await api.get(`/deal-interactions`, { dealId: deal.id });
        setRecent((res.data as any[]).slice(0, 3));
      } catch {}
    })();
  }, [deal.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar Deal</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Empresa</Label>
              <Input value={formState.company} onChange={(e) => handleChange('company', e.target.value)} />
            </div>
            <div>
              <Label>Contato</Label>
              <Input
                value={formState.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
              />
            </div>
          </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Valor</Label>
            <Input
              type="number"
              value={formState.value}
              onChange={(e) => handleChange('value', Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Estágio</Label>
            <Select value={formState.stage} onValueChange={(value) => handleChange('stage', value as DealStage)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o estágio" />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((stage) => (
                  <SelectItem key={stage.id} value={stage.id}>
                    {stage.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 border rounded-md">
            <div className="text-sm">Documentos vinculados</div>
            <div className="text-2xl font-bold">{docsCount}</div>
            <div className="mt-2 space-y-1 max-h-40 overflow-auto text-sm">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <div className="text-muted-foreground">
                    {(d.tipo || 'doc')}{d.pessoa ? ` • ${d.pessoa}` : ''}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => window.open(d.url, '_blank')}>Ver</Button>
                </div>
              ))}
              {docs.length === 0 && <div className="text-muted-foreground">Sem documentos</div>}
            </div>
          </div>
          <div className="p-3 border rounded-md">
            <div className="font-medium mb-2">Últimas interações</div>
            <div className="space-y-1 text-sm">
              {recent.map((r) => (
                <div key={r.id} className="text-muted-foreground">{new Date(r.created_at).toLocaleString('pt-BR')} • {r.type} {r.content ? `– ${r.content}` : ''}</div>
              ))}
              {recent.length === 0 && <div className="text-muted-foreground">Sem registros</div>}
            </div>
            <div className="mt-2 flex gap-2">
              <Input placeholder="Adicionar nota" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              <Button
                onClick={async () => {
                  if (!newNote.trim()) return;
                  try {
                    const { api } = await import('@/services/api');
                    await api.post('/deal-interactions', { dealId: deal.id, type: 'NOTE', content: newNote.trim() });
                    setNewNote('');
                    const res = await api.get(`/deal-interactions`, { dealId: deal.id });
                    setRecent((res.data as any[]).slice(0, 3));
                  } catch {
                    toast.error('Falha ao adicionar nota');
                  }
                }}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={formState.description ?? ''}
              onChange={(e) => handleChange('description', e.target.value)}
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => onSave(formState)}>Salvar alterações</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
