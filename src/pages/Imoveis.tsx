import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Bed, Bath, Car, MapPin, Eye, Edit, Trash, Home as HomeIcon, Building, Landmark, Trees } from 'lucide-react';
import { Property, propertiesService } from '@/services/properties';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const PropertyTypeIcon = ({ type }: { type: Property['type'] }) => {
  const icons = { house: HomeIcon, apartment: Building, commercial: Landmark, land: Trees, farm: Trees } as const;
  const Icon = icons[type] ?? HomeIcon;
  return <Icon className="h-4 w-4" />;
};

export default function Imoveis() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Partial<import('@/services/properties').PropertyFilters>>({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [formData, setFormData] = useState<Partial<Property>>({ type: 'apartment', transactionType: 'both', status: 'available' });

  const { data: propertiesData, isLoading } = useQuery({
    queryKey: ['properties', filters],
    queryFn: () => propertiesService.getProperties(filters)
  });

  const createMutation = useMutation({
    mutationFn: propertiesService.createProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({ title: 'Imóvel cadastrado com sucesso!' });
      setIsDialogOpen(false);
      setFormData({ type: 'apartment', transactionType: 'both', status: 'available' });
    },
    onError: () => toast({ title: 'Erro ao cadastrar imóvel', variant: 'destructive' })
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Property> }) => propertiesService.updateProperty(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({ title: 'Imóvel atualizado com sucesso!' });
      setIsDialogOpen(false);
      setSelectedProperty(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: propertiesService.deleteProperty,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({ title: 'Imóvel removido com sucesso!' });
    }
  });

  const generateDescriptionMutation = useMutation({
    mutationFn: ({ id, tone }: { id: string; tone: 'professional' | 'luxury' | 'casual' | 'persuasive' }) => propertiesService.generateDescription(id, tone),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({ title: 'Descrição gerada com IA!', description: 'A descrição foi atualizada automaticamente.' });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProperty) {
      updateMutation.mutate({ id: selectedProperty.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (property: Property) => {
    setSelectedProperty(property);
    setFormData(property);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Deseja realmente excluir este imóvel?')) {
      deleteMutation.mutate(id);
    }
  };

  const formatPrice = (price?: number) => (price ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price) : 'Sob consulta');

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Imóveis</h1>
            <p className="text-muted-foreground">Gerencie seu catálogo de imóveis</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setSelectedProperty(null); setFormData({ type: 'apartment', transactionType: 'both', status: 'available' }); }}>
                Novo Imóvel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedProperty ? 'Editar' : 'Cadastrar'} Imóvel</DialogTitle>
                <DialogDescription>Preencha os dados do imóvel</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Título *</Label>
                    <Input required value={formData.title || ''} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Apartamento 3 quartos no Centro" />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo *</Label>
                    <Select value={formData.type} onValueChange={(value: Property['type']) => setFormData({ ...formData, type: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apartment">Apartamento</SelectItem>
                        <SelectItem value="house">Casa</SelectItem>
                        <SelectItem value="commercial">Comercial</SelectItem>
                        <SelectItem value="land">Terreno</SelectItem>
                        <SelectItem value="farm">Chácara/Fazenda</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Transação *</Label>
                    <Select value={formData.transactionType} onValueChange={(value: Property['transactionType']) => setFormData({ ...formData, transactionType: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">Venda</SelectItem>
                        <SelectItem value="rent">Aluguel</SelectItem>
                        <SelectItem value="both">Venda e Aluguel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(value: Property['status']) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponível</SelectItem>
                        <SelectItem value="reserved">Reservado</SelectItem>
                        <SelectItem value="sold">Vendido</SelectItem>
                        <SelectItem value="rented">Alugado</SelectItem>
                        <SelectItem value="unavailable">Indisponível</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(formData.transactionType === 'sale' || formData.transactionType === 'both') && (
                    <div className="space-y-2">
                      <Label>Preço de Venda</Label>
                      <Input type="number" value={formData.price || ''} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} placeholder="350000" />
                    </div>
                  )}
                  {(formData.transactionType === 'rent' || formData.transactionType === 'both') && (
                    <div className="space-y-2">
                      <Label>Valor do Aluguel</Label>
                      <Input type="number" value={formData.rentPrice || ''} onChange={(e) => setFormData({ ...formData, rentPrice: parseFloat(e.target.value) })} placeholder="1500" />
                    </div>
                  )}
                  <div className="space-y-2"><Label>Quartos</Label><Input type="number" value={formData.bedrooms || ''} onChange={(e) => setFormData({ ...formData, bedrooms: parseInt(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Banheiros</Label><Input type="number" value={formData.bathrooms || ''} onChange={(e) => setFormData({ ...formData, bathrooms: parseInt(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Vagas Garagem</Label><Input type="number" value={formData.parkingSpaces || ''} onChange={(e) => setFormData({ ...formData, parkingSpaces: parseInt(e.target.value) })} /></div>
                  <div className="space-y-2"><Label>Área (m²)</Label><Input type="number" value={formData.area || ''} onChange={(e) => setFormData({ ...formData, area: parseFloat(e.target.value) })} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço Completo *</Label>
                  <Input required value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Rua, número, complemento" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2"><Label>Bairro</Label><Input value={formData.neighborhood || ''} onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Cidade *</Label><Input required value={formData.city || ''} onChange={(e) => setFormData({ ...formData, city: e.target.value })} /></div>
                  <div className="space-y-2"><Label>Estado *</Label><Input required value={formData.state || ''} onChange={(e) => setFormData({ ...formData, state: e.target.value })} /></div>
                </div>
                <div className="space-y-2"><Label>Descrição</Label><Textarea value={formData.description || ''} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} /></div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit">{selectedProperty ? 'Atualizar' : 'Criar'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader><CardTitle>Filtros</CardTitle><CardDescription>Refine sua busca</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input placeholder="Buscar por título, cidade..." className="max-w-sm" onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })} />
            <Select onValueChange={(value) => setFilters({ ...filters, type: value === 'all' ? undefined : value })}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="apartment">Apartamento</SelectItem>
                <SelectItem value="house">Casa</SelectItem>
                <SelectItem value="commercial">Comercial</SelectItem>
                <SelectItem value="land">Terreno</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => setFilters({ ...filters, transactionType: value === 'all' ? undefined : value })}>
              <SelectTrigger><SelectValue placeholder="Transação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="sale">Venda</SelectItem>
                <SelectItem value="rent">Aluguel</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => setFilters({ ...filters, status: value === 'all' ? undefined : value })}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponível</SelectItem>
                <SelectItem value="reserved">Reservado</SelectItem>
                <SelectItem value="sold">Vendido</SelectItem>
                <SelectItem value="rented">Alugado</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">Carregando...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {propertiesData?.data.map((property) => (
              <Card key={property.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <div className="h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <PropertyTypeIcon type={property.type} />
                </div>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{property.title}</CardTitle>
                      <div className="flex items-center text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3 mr-1" />
                        {property.city}, {property.state}
                      </div>
                    </div>
                    <Badge variant={property.status === 'available' ? 'default' : 'secondary'}>{property.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      {property.bedrooms && (<div className="flex items-center"><Bed className="h-4 w-4 mr-1" />{property.bedrooms}</div>)}
                      {property.bathrooms && (<div className="flex items-center"><Bath className="h-4 w-4 mr-1" />{property.bathrooms}</div>)}
                      {property.parkingSpaces && (<div className="flex items-center"><Car className="h-4 w-4 mr-1" />{property.parkingSpaces}</div>)}
                    </div>
                  </div>
                  <div className="space-y-1">
                    {property.transactionType !== 'rent' && property.price && (
                      <div className="text-lg font-bold text-primary">{formatPrice(property.price)}</div>
                    )}
                    {property.transactionType !== 'sale' && property.rentPrice && (
                      <div className="text-sm text-muted-foreground">Aluguel: {formatPrice(property.rentPrice)}/mês</div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline" className="flex-1"><Eye className="h-4 w-4 mr-1" />Ver</Button>
                    <Button size="sm" variant="outline" onClick={() => handleEdit(property)}><Edit className="h-4 w-4" /></Button>
                    <Button size="sm" variant="outline" onClick={() => handleDelete(property.id)} disabled={deleteMutation.isPending}><Trash className="h-4 w-4" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
