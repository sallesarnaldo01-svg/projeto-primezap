import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Ticket,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  XCircle,
  User,
  Calendar,
  Tag,
  TrendingUp,
  Users,
  Timer,
  RefreshCcw,
  Activity,
} from 'lucide-react';
import {
  useTickets,
  useTicketMutations,
  FALLBACK_TICKETS,
  FALLBACK_METRICS,
  type UITicket,
} from '@/hooks/useTickets';

const PRIORITY_LABELS: Record<UITicket['priority'], { label: string; className: string }> = {
  low: { label: 'Baixa', className: 'bg-green-500' },
  medium: { label: 'Média', className: 'bg-yellow-500' },
  high: { label: 'Alta', className: 'bg-orange-500' },
  urgent: { label: 'Urgente', className: 'bg-red-500' },
};

const STATUS_LABELS: Record<UITicket['status'], { label: string; className: string }> = {
  open: { label: 'Aberto', className: 'bg-blue-500' },
  in_progress: { label: 'Em Andamento', className: 'bg-yellow-500' },
  resolved: { label: 'Resolvido', className: 'bg-green-500' },
  closed: { label: 'Fechado', className: 'bg-gray-500' },
};

const formatDate = (date: Date | undefined) =>
  date ? date.toLocaleString('pt-BR') : '—';

const getSlaStatus = (deadline?: Date) => {
  if (!deadline) return { color: 'text-muted-foreground', label: 'Sem SLA' };
  const now = new Date();
  const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursLeft < 0) return { color: 'text-red-500', label: 'Vencido' };
  if (hoursLeft < 2) return { color: 'text-orange-500', label: 'Crítico' };
  if (hoursLeft < 8) return { color: 'text-yellow-500', label: 'Atenção' };
  return { color: 'text-green-500', label: 'No prazo' };
};

const filterTickets = (
  tickets: UITicket[],
  search: string,
  status: string,
  priority: string,
  category: string,
) => {
  return tickets.filter((ticket) => {
    const matchesSearch =
      ticket.title.toLowerCase().includes(search.toLowerCase()) ||
      ticket.description.toLowerCase().includes(search.toLowerCase()) ||
      ticket.customer.name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = status === 'all' || ticket.status === status;
    const matchesPriority = priority === 'all' || ticket.priority === priority;
    const matchesCategory = category === 'all' || ticket.category === category;

    return matchesSearch && matchesStatus && matchesPriority && matchesCategory;
  });
};

const computeRoleStats = (tickets: UITicket[]) => ({
  open: tickets.filter((ticket) => ticket.status === 'open').length,
  inProgress: tickets.filter((ticket) => ticket.status === 'in_progress').length,
  resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
  closed: tickets.filter((ticket) => ticket.status === 'closed').length,
});

const formatHours = (hours: number) =>
  `${hours.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;

export default function Tickets() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'Técnico',
    customerName: '',
    contactId: '',
  });

  const [localTickets, setLocalTickets] = useState<UITicket[]>(FALLBACK_TICKETS);

  const filters = useMemo(
    () => ({
      status: filterStatus !== 'all' ? filterStatus : undefined,
      priority: filterPriority !== 'all' ? filterPriority : undefined,
      category: filterCategory !== 'all' ? filterCategory : undefined,
      search: searchTerm.trim() || undefined,
    }),
    [filterStatus, filterPriority, filterCategory, searchTerm],
  );

  const { tickets, metrics, isLoading, isFallback, refetch } = useTickets(filters);
  const { createTicket, updateTicket, deleteTicket, isCreating } = useTicketMutations();

  const ticketSource = isFallback ? localTickets : tickets;

  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(
    ticketSource[0]?.id ?? null,
  );

  useEffect(() => {
    if (ticketSource.length === 0) {
      setSelectedTicketId(null);
      return;
    }
    if (!selectedTicketId || !ticketSource.some((ticket) => ticket.id === selectedTicketId)) {
      setSelectedTicketId(ticketSource[0].id);
    }
  }, [ticketSource, selectedTicketId]);

  const filteredTickets = useMemo(
    () => filterTickets(ticketSource, searchTerm, filterStatus, filterPriority, filterCategory),
    [ticketSource, searchTerm, filterStatus, filterPriority, filterCategory],
  );

  const selectedTicket = filteredTickets.find((ticket) => ticket.id === selectedTicketId)
    ?? filteredTickets[0]
    ?? null;

  const roleStats = computeRoleStats(ticketSource);

  const mutateLocalTickets = (updater: (prev: UITicket[]) => UITicket[]) => {
    setLocalTickets((prev) => updater(prev));
  };

  const handleCreateTicket = async () => {
    if (!newTicket.title.trim() || !newTicket.description.trim()) {
      toast.error('Título e descrição são obrigatórios.');
      return;
    }

    if (isFallback) {
      const ticket: UITicket = {
        id: `T-${String(localTickets.length + 1).padStart(3, '0')}`,
        title: newTicket.title,
        description: newTicket.description,
        status: 'open',
        priority: newTicket.priority as UITicket['priority'],
        category: newTicket.category,
        customer: {
          name: newTicket.customerName || 'Cliente Desconhecido',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
        tags: [],
        messages: [
          {
            id: '1',
            content: newTicket.description,
            author: newTicket.customerName || 'Cliente',
            timestamp: new Date(),
            type: 'message',
          },
        ],
      };

      mutateLocalTickets((prev) => [ticket, ...prev]);
      toast.success('Ticket criado localmente.');
    } else {
      if (!newTicket.contactId.trim()) {
        toast.error('Informe o ID do contato para criar o ticket.');
        return;
      }

      try {
        await createTicket({
          title: newTicket.title,
          description: newTicket.description,
          priority: newTicket.priority as UITicket['priority'],
          category: newTicket.category,
          contactId: newTicket.contactId,
          source: 'chat',
        });
        await refetch();
      } catch (error) {
        return;
      }
    }

    setNewTicket({
      title: '',
      description: '',
      priority: 'medium',
      category: 'Técnico',
      customerName: '',
      contactId: '',
    });
    setIsCreateModalOpen(false);
  };

  const handleUpdateStatus = async (ticket: UITicket, status: UITicket['status']) => {
    if (isFallback) {
      mutateLocalTickets((prev) =>
        prev.map((item) =>
          item.id === ticket.id ? { ...item, status, updatedAt: new Date() } : item,
        ),
      );
      toast.success('Status atualizado.');
      return;
    }

    try {
      await updateTicket({ id: ticket.id, data: { status } });
      await refetch();
    } catch (error) {
      /* handled by hook */
    }
  };

  const handleDeleteTicket = async (ticket: UITicket) => {
    if (isFallback) {
      mutateLocalTickets((prev) => prev.filter((item) => item.id !== ticket.id));
      toast.success('Ticket removido.');
      return;
    }

    try {
      await deleteTicket(ticket.id);
      await refetch();
    } catch (error) {
      /* handled by hook */
    }
  };

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Tickets de Suporte</h1>
          <p className="text-muted-foreground">
            Gerencie solicitações e problemas dos clientes em tempo real
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Novo Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Criar Novo Ticket</DialogTitle>
                <DialogDescription>
                  Preencha as informações para registrar um novo ticket de suporte
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input
                      id="title"
                      value={newTicket.title}
                      onChange={(event) =>
                        setNewTicket((prev) => ({ ...prev, title: event.target.value }))
                      }
                      placeholder="Descreva o problema em poucas palavras"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customer">Cliente</Label>
                    <Input
                      id="customer"
                      value={newTicket.customerName}
                      onChange={(event) =>
                        setNewTicket((prev) => ({ ...prev, customerName: event.target.value }))
                      }
                      placeholder="Nome do cliente (opcional)"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição *</Label>
                  <Textarea
                    id="description"
                    value={newTicket.description}
                    onChange={(event) =>
                      setNewTicket((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Descreva detalhadamente o problema ou solicitação"
                    rows={4}
                  />
                </div>

                {!isFallback && (
                  <div className="space-y-2">
                    <Label htmlFor="contactId">ID do Contato *</Label>
                    <Input
                      id="contactId"
                      value={newTicket.contactId}
                      onChange={(event) =>
                        setNewTicket((prev) => ({ ...prev, contactId: event.target.value }))
                      }
                      placeholder="ID do contato no CRM (necessário para registrar no backend)"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prioridade</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(value) =>
                        setNewTicket((prev) => ({ ...prev, priority: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="medium">Média</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={newTicket.category}
                      onValueChange={(value) =>
                        setNewTicket((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Técnico">Técnico</SelectItem>
                        <SelectItem value="Funcionalidade">Funcionalidade</SelectItem>
                        <SelectItem value="Billing">Cobrança</SelectItem>
                        <SelectItem value="Suporte">Suporte Geral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateTicket} disabled={isCreating}>
                    Criar Ticket
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.total}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> {roleStats.open} abertos
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tickets em Andamento</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roleStats.inProgress}</div>
            <Progress value={(roleStats.inProgress / Math.max(metrics.total, 1)) * 100} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio de Resolução</CardTitle>
            <Timer className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatHours(metrics.avgResolution)}</div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cumprimento de SLA</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.slaCompliance.toLocaleString('pt-BR', {
                maximumFractionDigits: 1,
              })}
              %
            </div>
            <p className="text-xs text-muted-foreground">Dentro do prazo</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Filtrar Tickets</CardTitle>
              <CardDescription>Visualize e priorize o trabalho da sua equipe</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tickets..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="in_progress">Em andamento</SelectItem>
                  <SelectItem value="resolved">Resolvido</SelectItem>
                  <SelectItem value="closed">Fechado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="Técnico">Técnico</SelectItem>
                  <SelectItem value="Funcionalidade">Funcionalidade</SelectItem>
                  <SelectItem value="Billing">Cobrança</SelectItem>
                  <SelectItem value="Suporte">Suporte Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lista de Tickets</CardTitle>
            <CardDescription>
              {filteredTickets.length} ticket(s) encontrados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && filteredTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando tickets...</p>
            ) : filteredTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
            ) : (
              filteredTickets.map((ticket) => {
                const priorityInfo = PRIORITY_LABELS[ticket.priority];
                const statusInfo = STATUS_LABELS[ticket.status];
                const slaInfo = getSlaStatus(ticket.slaDeadline);
                const isSelected = ticket.id === selectedTicketId;

                return (
                  <motion.div
                    key={ticket.id}
                    whileHover={{ scale: 1.01 }}
                    className={`rounded-lg border p-4 transition-shadow ${
                      isSelected ? 'border-primary shadow-sm' : 'hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedTicketId(ticket.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge>{ticket.id}</Badge>
                          <Badge className={`${priorityInfo.className} text-white`}>
                            {priorityInfo.label}
                          </Badge>
                          <Badge className={`${statusInfo.className} text-white`}>
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <h3 className="mt-3 text-lg font-semibold">{ticket.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {ticket.description}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {ticket.customer.name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Criado em {formatDate(ticket.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Tag className="h-4 w-4" />
                            {ticket.category}
                          </span>
                          <span className={`flex items-center gap-1 ${slaInfo.color}`}>
                            <Clock className="h-4 w-4" />
                            SLA: {slaInfo.label}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ticket.tags.map((tag) => (
                            <Badge key={tag} variant="outline">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleUpdateStatus(ticket, 'in_progress');
                          }}
                        >
                          <Activity className="mr-1 h-4 w-4" />
                          Em andamento
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleUpdateStatus(ticket, 'resolved');
                          }}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Resolver
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteTicket(ticket);
                          }}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Remover
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Detalhes do Ticket</CardTitle>
            <CardDescription>
              {selectedTicket
                ? `Última atualização em ${formatDate(selectedTicket.updatedAt)}`
                : 'Selecione um ticket para visualizar os detalhes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedTicket ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold">{selectedTicket.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedTicket.description}
                  </p>
                </div>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Cliente</span>
                    <span>{selectedTicket.customer.name}</span>
                  </div>
                  {selectedTicket.customer.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Email</span>
                      <span>{selectedTicket.customer.email}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Criado em</span>
                    <span>{formatDate(selectedTicket.createdAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Atualizado em</span>
                    <span>{formatDate(selectedTicket.updatedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">SLA</span>
                    <span className={getSlaStatus(selectedTicket.slaDeadline).color}>
                      {getSlaStatus(selectedTicket.slaDeadline).label}
                    </span>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="mb-2 font-semibold">Histórico</h4>
                  <div className="space-y-3">
                    {selectedTicket.messages.map((message) => (
                      <div key={message.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{message.author}</span>
                          <span className="text-xs text-muted-foreground">
                            {message.timestamp.toLocaleString('pt-BR')}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {message.content}
                        </p>
                        <Badge variant="outline" className="mt-2 text-xs">
                          {message.type === 'message'
                            ? 'Mensagem'
                            : message.type === 'note'
                            ? 'Nota interna'
                            : 'Sistema'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um ticket para visualizar os detalhes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
