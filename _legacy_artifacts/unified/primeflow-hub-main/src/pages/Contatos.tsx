import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Download,
  RefreshCw,
  Search,
  Filter,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';

const fallbackContacts = [
  {
    id: '1',
    name: 'João Silva',
    phone: '+55 11 98765-4321',
    email: 'joao@example.com',
    origin: 'whatsapp',
    tags: ['Cliente', 'VIP'],
    lastContact: '2024-01-15',
  },
  {
    id: '2',
    name: 'Maria Santos',
    phone: '+55 11 98765-4322',
    email: 'maria@example.com',
    origin: 'instagram',
    tags: ['Lead'],
    lastContact: '2024-01-14',
  },
];

export default function Contatos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedChannels, setSelectedChannels] = useState({
    whatsapp: false,
    facebook: false,
    instagram: false,
  });

  const contactsQuery = useContacts(
    searchTerm ? { search: searchTerm, page: 1, limit: 50 } : undefined,
  );

  const contacts = contactsQuery.data?.data ?? fallbackContacts;

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const query = searchTerm.toLowerCase();

    return contacts.filter((contact) => {
      const matchesName = contact.name.toLowerCase().includes(query);
      const matchesPhone = contact.phone.toLowerCase().includes(query);
      const matchesEmail = contact.email?.toLowerCase().includes(query);
      const matchesTag = contact.tags.some((tag) => tag.toLowerCase().includes(query));
      return matchesName || matchesPhone || matchesEmail || matchesTag;
    });
  }, [contacts, searchTerm]);

  const stats = {
    total: contactsQuery.data?.pagination.total ?? contacts.length,
    new: contactsQuery.data?.data?.length ?? contacts.length,
    synced: contacts.length,
    failed: 0,
  };

  const handleSync = async () => {
    const selected = Object.entries(selectedChannels)
      .filter(([_, value]) => value)
      .map(([key]) => key);

    if (selected.length === 0) {
      toast.error('Selecione pelo menos um canal');
      return;
    }

    setSyncing(true);
    setSyncProgress(0);

    // Simular sincronização
    const interval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setSyncing(false);
          setSyncModalOpen(false);
          toast.success('Contatos sincronizados com sucesso!');
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const handleExport = (format: 'csv' | 'json') => {
    if (filteredContacts.length === 0) {
      toast.error('Nenhum contato disponível para exportação com os filtros atuais.');
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `contatos_${timestamp}.${format}`;
      let blob: Blob;

      if (format === 'csv') {
        const headers = ['id', 'name', 'phone', 'email', 'origin', 'tags', 'lastContact'];
        const rows = filteredContacts.map((contact) =>
          headers
            .map((key) => {
              const value = key === 'tags'
                ? contact.tags.join('|')
                : // @ts-expect-error runtime access
                  contact[key] ?? '';
              const safe = String(value).replace(/"/g, '""');
              return `"${safe}"`;
            })
            .join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');
        blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      } else {
        const json = JSON.stringify(filteredContacts, null, 2);
        blob = new Blob([json], { type: 'application/json' });
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`Exportação ${format.toUpperCase()} gerada com sucesso.`);
    } catch (error) {
      console.error('Export contacts error:', error);
      toast.error('Não foi possível exportar os contatos.');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Contatos</h1>
            <p className="text-muted-foreground">
              Gerencie e sincronize seus contatos de todos os canais
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setSyncModalOpen(true)}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sincronizar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('csv')}>
                  Exportar como CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('json')}>
                  Exportar como JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">contatos cadastrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Novos</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.new}</div>
              <p className="text-xs text-muted-foreground">últimos 7 dias</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sincronizados</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.synced}</div>
              <p className="text-xs text-muted-foreground">com canais</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Falhas</CardTitle>
              <XCircle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.failed}</div>
              <p className="text-xs text-muted-foreground">erros na sincronização</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou e-mail..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Contacts List */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Contatos</CardTitle>
            <CardDescription>
              {filteredContacts.length} contatos encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {contactsQuery.isLoading && (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Carregando contatos...
                </div>
              )}

              {!contactsQuery.isLoading && filteredContacts.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Nenhum contato encontrado com os filtros atuais.
                </p>
              )}

              {!contactsQuery.isLoading &&
                filteredContacts.map((contact) => {
                  const initials = contact.name
                    ? contact.name
                        .split(' ')
                        .filter(Boolean)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : '—';

                  const lastInteraction =
                    'lastContact' in contact && contact.lastContact
                      ? contact.lastContact
                      : contact.updatedAt
                      ? new Date(contact.updatedAt).toLocaleDateString('pt-BR')
                      : '—';

                  const tags = 'tags' in contact ? contact.tags ?? [] : [];
                  const conversationsCount = contact._count?.conversations ?? 0;
                  const dealsCount = contact._count?.deals ?? 0;

                  return (
                    <div
                      key={contact.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-semibold text-primary">{initials}</span>
                        </div>
                        <div>
                          <h3 className="font-medium">{contact.name}</h3>
                          <div className="flex gap-2 text-sm text-muted-foreground flex-wrap">
                            {contact.phone && <span>{contact.phone}</span>}
                            {contact.email && <span>• {contact.email}</span>}
                          </div>
                          {tags.length > 0 && (
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <div className="text-xs text-muted-foreground">
                          Conversas: {conversationsCount}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Deals: {dealsCount}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Última atividade: {lastInteraction}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>

        {/* Sync Modal */}
        <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sincronizar Contatos</DialogTitle>
              <DialogDescription>
                Selecione os canais que deseja sincronizar
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="whatsapp"
                  checked={selectedChannels.whatsapp}
                  onCheckedChange={(checked) =>
                    setSelectedChannels({ ...selectedChannels, whatsapp: checked as boolean })
                  }
                />
                <label htmlFor="whatsapp" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  WhatsApp
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="facebook"
                  checked={selectedChannels.facebook}
                  onCheckedChange={(checked) =>
                    setSelectedChannels({ ...selectedChannels, facebook: checked as boolean })
                  }
                />
                <label htmlFor="facebook" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Facebook
                </label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="instagram"
                  checked={selectedChannels.instagram}
                  onCheckedChange={(checked) =>
                    setSelectedChannels({ ...selectedChannels, instagram: checked as boolean })
                  }
                />
                <label htmlFor="instagram" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Instagram
                </label>
              </div>

              {syncing && (
                <div className="space-y-2">
                  <Progress value={syncProgress} />
                  <p className="text-sm text-muted-foreground text-center">
                    Sincronizando... {syncProgress}%
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSyncModalOpen(false)} disabled={syncing}>
                Cancelar
              </Button>
              <Button onClick={handleSync} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Sincronizar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </>
  );
}
