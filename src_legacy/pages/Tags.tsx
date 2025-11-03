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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Tag as TagIcon,
  Plus,
  Search,
  Filter,
  Hash,
  Palette,
  Edit,
  Trash2,
  Users,
  MessageSquare,
  Building2,
  Ticket,
  RefreshCcw,
  Settings,
  Download,
} from 'lucide-react';
import {
  useTags,
  useTagMutations,
  FALLBACK_TAGS,
  type UITag,
} from '@/hooks/useTags';

const CATEGORY_LABELS: Record<UITag['category'], string> = {
  general: 'Geral',
  customer: 'Clientes',
  product: 'Produto',
  support: 'Suporte',
  sales: 'Vendas',
  marketing: 'Marketing',
};

const ACTIVE_LABELS: Record<'all' | 'active' | 'inactive', string> = {
  all: 'Todas',
  active: 'Ativas',
  inactive: 'Inativas',
};

const filterTags = (
  tags: UITag[],
  search: string,
  category: string,
  activeFilter: string,
) =>
  tags.filter((tag) => {
    const matchesSearch =
      tag.name.toLowerCase().includes(search.toLowerCase()) ||
      tag.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || tag.category === category;
    const matchesActive =
      activeFilter === 'all' ||
      (activeFilter === 'active' ? tag.isActive : !tag.isActive);
    return matchesSearch && matchesCategory && matchesActive;
  });

const formatUsage = (count: number) =>
  count.toLocaleString('pt-BR', { minimumFractionDigits: 0 });

export default function Tags() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editedTag, setEditedTag] = useState<UITag | null>(null);
  const [newTag, setNewTag] = useState({
    name: '',
    color: '#4A90E2',
    description: '',
    category: 'general' as UITag['category'],
  });

  const [localTags, setLocalTags] = useState<UITag[]>(FALLBACK_TAGS);

  const filters = useMemo(
    () => ({
      search: searchTerm.trim() || undefined,
      category: filterCategory !== 'all' ? filterCategory : undefined,
    }),
    [filterCategory, searchTerm],
  );

  const { tags, isLoading, isFallback, refetch } = useTags(filters);
  const { createTag, updateTag, deleteTag, isCreating, isUpdating } = useTagMutations();

  const tagSource = isFallback ? localTags : tags;

  const [selectedTagId, setSelectedTagId] = useState<string | null>(
    tagSource[0]?.id ?? null,
  );

  useEffect(() => {
    if (tagSource.length === 0) {
      setSelectedTagId(null);
      return;
    }
    if (!selectedTagId || !tagSource.some((tag) => tag.id === selectedTagId)) {
      setSelectedTagId(tagSource[0].id);
    }
  }, [tagSource, selectedTagId]);

  const filteredTags = useMemo(
    () => filterTags(tagSource, searchTerm, filterCategory, filterActive),
    [tagSource, searchTerm, filterCategory, filterActive],
  );

  const selectedTag =
    filteredTags.find((tag) => tag.id === selectedTagId) ?? filteredTags[0] ?? null;

  const mutateLocalTags = (updater: (prev: UITag[]) => UITag[]) => {
    setLocalTags((prev) => updater(prev));
  };

  const handleCreateTag = async () => {
    if (!newTag.name.trim()) {
      toast.error('Informe um nome para a tag.');
      return;
    }

    if (isFallback) {
      const tag: UITag = {
        id: `tag-${Date.now()}`,
        name: newTag.name,
        color: newTag.color,
        description: newTag.description || undefined,
        category: newTag.category,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        usageCount: {
          contacts: 0,
          companies: 0,
          deals: 0,
          tickets: 0,
          conversations: 0,
        },
        createdBy: 'Você',
      };

      mutateLocalTags((prev) => [tag, ...prev]);
      toast.success('Tag criada localmente.');
    } else {
      try {
        await createTag({
          name: newTag.name,
          color: newTag.color,
          description: newTag.description || undefined,
          category: newTag.category,
        });
        await refetch();
      } catch (error) {
        return;
      }
    }

    setNewTag({
      name: '',
      color: '#4A90E2',
      description: '',
      category: 'general',
    });
    setIsCreateModalOpen(false);
  };

  const handleUpdateTag = async () => {
    if (!editedTag) return;

    if (isFallback) {
      mutateLocalTags((prev) =>
        prev.map((tag) =>
          tag.id === editedTag.id
            ? { ...tag, ...editedTag, updatedAt: new Date() }
            : tag,
        ),
      );
      toast.success('Tag atualizada localmente.');
      setIsEditModalOpen(false);
      return;
    }

    try {
      await updateTag({
        id: editedTag.id,
        data: {
          name: editedTag.name,
          color: editedTag.color,
          description: editedTag.description,
          category: editedTag.category,
        },
      });
      setIsEditModalOpen(false);
      await refetch();
    } catch (error) {
      /* handled by hook */
    }
  };

  const handleDeleteTag = async (tag: UITag) => {
    if (isFallback) {
      mutateLocalTags((prev) => prev.filter((item) => item.id !== tag.id));
      toast.success('Tag removida localmente.');
      return;
    }

    try {
      await deleteTag(tag.id);
      await refetch();
    } catch (error) {
      /* handled by hook */
    }
  };

  const totalUsage = tagSource.reduce(
    (acc, tag) =>
      acc +
      tag.usageCount.contacts +
      tag.usageCount.companies +
      tag.usageCount.deals +
      tag.usageCount.tickets +
      tag.usageCount.conversations,
    0,
  );

  const usageRate = totalUsage > 0 ? (tagSource.length / totalUsage) * 100 : 0;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Tags & Segmentação</h1>
          <p className="text-muted-foreground">
            Organize contatos, tickets e conversas com classificações inteligentes
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
                Nova Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar nova tag</DialogTitle>
                <DialogDescription>
                  Categorize seus registros com tags personalizadas
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={newTag.name}
                    onChange={(event) =>
                      setNewTag((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Nome da tag"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={newTag.description}
                    onChange={(event) =>
                      setNewTag((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Como essa tag será utilizada?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select
                      value={newTag.category}
                      onValueChange={(value: UITag['category']) =>
                        setNewTag((prev) => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Cor</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="color"
                        value={newTag.color}
                        onChange={(event) =>
                          setNewTag((prev) => ({ ...prev, color: event.target.value }))
                        }
                        className="h-10 w-16 p-1"
                      />
                      <Input
                        value={newTag.color}
                        onChange={(event) =>
                          setNewTag((prev) => ({ ...prev, color: event.target.value }))
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleCreateTag} disabled={isCreating}>
                    Criar Tag
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
            <CardTitle className="text-sm font-medium">Total de Tags</CardTitle>
            <TagIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tagSource.length}</div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" /> {formatUsage(totalUsage)} utilizações
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tags Ativas</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {tagSource.filter((tag) => tag.isActive).length}
            </div>
            <Progress value={usageRate} className="mt-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uso em Tickets</CardTitle>
            <Ticket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUsage(
                tagSource.reduce((acc, tag) => acc + tag.usageCount.tickets, 0),
              )}
            </div>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uso em Conversas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatUsage(
                tagSource.reduce((acc, tag) => acc + tag.usageCount.conversations, 0),
              )}
            </div>
            <p className="text-xs text-muted-foreground">Canal omnichannel</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>
                Refine sua busca para encontrar a tag ideal
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tags..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterActive}
                onValueChange={(value: 'all' | 'active' | 'inactive') => setFilterActive(value)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACTIVE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tags</CardTitle>
            <CardDescription>
              {filteredTags.length} tag(s) encontradas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && filteredTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando tags...</p>
            ) : filteredTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma tag encontrada.</p>
            ) : (
              filteredTags.map((tag) => {
                const isSelected = tag.id === selectedTagId;
                return (
                  <motion.div
                    key={tag.id}
                    whileHover={{ scale: 1.01 }}
                    className={`rounded-lg border p-4 transition-shadow ${
                      isSelected ? 'border-primary shadow-sm' : 'hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedTagId(tag.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <h3 className="text-lg font-semibold">{tag.name}</h3>
                          <Badge variant={tag.isActive ? 'default' : 'outline'}>
                            {tag.isActive ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {tag.description || 'Sem descrição'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {CATEGORY_LABELS[tag.category]}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {formatUsage(tag.usageCount.contacts)} contatos
                          </span>
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {formatUsage(tag.usageCount.companies)} empresas
                          </span>
                          <span className="flex items-center gap-1">
                            <Ticket className="h-3 w-3" />
                            {formatUsage(tag.usageCount.tickets)} tickets
                          </span>
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" />
                            {formatUsage(tag.usageCount.conversations)} conversas
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditedTag(tag);
                            setIsEditModalOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteTag(tag);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detalhes da Tag</CardTitle>
            <CardDescription>
              {selectedTag
                ? `Criada por ${selectedTag.createdBy}`
                : 'Selecione uma tag para visualizar detalhes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedTag ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Nome</span>
                  <span className="font-medium">{selectedTag.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Categoria</span>
                  <Badge variant="outline">{CATEGORY_LABELS[selectedTag.category]}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Criada em</span>
                  <span>{selectedTag.createdAt.toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Atualizada em</span>
                  <span>{selectedTag.updatedAt.toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Cor</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="h-4 w-4 rounded-full border"
                      style={{ backgroundColor: selectedTag.color }}
                    />
                    <span>{selectedTag.color}</span>
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold">Resumo de uso</h4>
                  <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Contatos</span>
                      <span>{formatUsage(selectedTag.usageCount.contacts)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Empresas</span>
                      <span>{formatUsage(selectedTag.usageCount.companies)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Deals</span>
                      <span>{formatUsage(selectedTag.usageCount.deals)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Tickets</span>
                      <span>{formatUsage(selectedTag.usageCount.tickets)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Conversas</span>
                      <span>{formatUsage(selectedTag.usageCount.conversations)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione uma tag para visualizar os detalhes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar tag</DialogTitle>
          </DialogHeader>
          {editedTag && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome</Label>
                <Input
                  id="edit-name"
                  value={editedTag.name}
                  onChange={(event) =>
                    setEditedTag((prev) => prev && { ...prev, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea
                  id="edit-description"
                  value={editedTag.description ?? ''}
                  onChange={(event) =>
                    setEditedTag((prev) => prev && { ...prev, description: event.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select
                    value={editedTag.category}
                    onValueChange={(value: UITag['category']) =>
                      setEditedTag((prev) => prev && { ...prev, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={editedTag.color}
                      onChange={(event) =>
                        setEditedTag((prev) => prev && { ...prev, color: event.target.value })
                      }
                      className="h-10 w-16 p-1"
                    />
                    <Input
                      value={editedTag.color}
                      onChange={(event) =>
                        setEditedTag((prev) => prev && { ...prev, color: event.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditedTag((prev) => prev && { ...prev, isActive: !prev.isActive })
                  }
                >
                  {editedTag.isActive ? 'Desativar' : 'Ativar'}
                </Button>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateTag} disabled={isUpdating}>
                  Salvar alterações
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
