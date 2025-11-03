import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AvatarUpload } from '@/components/ui/avatar-upload';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
  useUsers,
  useUserMutations,
  FALLBACK_USERS,
  type UIUser,
} from '@/hooks/useUsers';
import type { UserRole } from '@/services/users';
import {
  Plus,
  Search,
  Filter,
  Users,
  UserPlus,
  Settings,
  Eye,
  Edit,
  Trash2,
  Crown,
  Star,
  Clock,
  Mail,
  Phone,
  RefreshCcw,
} from 'lucide-react';

const ROLE_LABELS: Record<UIUser['role'], { label: string; badge: string; icon: React.ElementType }> = {
  admin: { label: 'Administrador', badge: 'bg-red-100 text-red-700', icon: Crown },
  manager: { label: 'Gerente', badge: 'bg-blue-100 text-blue-700', icon: Star },
  agent: { label: 'Agente', badge: 'bg-green-100 text-green-700', icon: Users },
  viewer: { label: 'Visualizador', badge: 'bg-gray-100 text-gray-700', icon: Eye },
};

const STATUS_BADGES: Record<UIUser['status'], string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-red-100 text-red-700',
  pending: 'bg-yellow-100 text-yellow-700',
};

const formatLastLogin = (date?: Date) => {
  if (!date) return 'Nunca acessou';
  const now = new Date();
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffInHours < 1) return 'Agora mesmo';
  if (diffInHours < 24) return `${diffInHours}h atrás`;
  return date.toLocaleDateString('pt-BR');
};

const filterUsers = (users: UIUser[], search: string, roleFilter: string, departmentFilter: string) =>
  users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.department ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesDepartment =
      departmentFilter === 'all' || (user.department ?? '').toLowerCase() === departmentFilter.toLowerCase();
    return matchesSearch && matchesRole && matchesDepartment;
  });

export default function Usuarios() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedDepartment, setSelectedDepartment] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UIUser | null>(null);
  const [localUsers, setLocalUsers] = useState<UIUser[]>(FALLBACK_USERS);

  const filters = useMemo(
    () => ({
      search: searchTerm.trim() || undefined,
      role: selectedRole !== 'all' ? selectedRole : undefined,
      department: selectedDepartment !== 'all' ? selectedDepartment : undefined,
    }),
    [searchTerm, selectedRole, selectedDepartment],
  );

  const { users, isLoading, isFallback, refetch } = useUsers(filters);
  const { createUser, updateUser, deleteUser, isCreating, isUpdating } = useUserMutations();

  const userSource = isFallback ? localUsers : users;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(userSource[0]?.id ?? null);

  useEffect(() => {
    if (userSource.length === 0) {
      setSelectedUserId(null);
      return;
    }
    if (!selectedUserId || !userSource.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(userSource[0].id);
    }
  }, [userSource, selectedUserId]);

  const filteredUsers = useMemo(
    () => filterUsers(userSource, searchTerm, selectedRole, selectedDepartment),
    [userSource, searchTerm, selectedRole, selectedDepartment],
  );

  const selectedUser =
    filteredUsers.find((user) => user.id === selectedUserId) ?? filteredUsers[0] ?? null;

  const mutateLocalUsers = (updater: (prev: UIUser[]) => UIUser[]) => {
    setLocalUsers((prev) => updater(prev));
  };

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('name') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const role = String(formData.get('role') ?? 'agent') as UIUser['role'];
    const department = String(formData.get('department') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();

    if (!name || !email) {
      toast.error('Nome e e-mail são obrigatórios.');
      return;
    }

    if (isFallback) {
      const user: UIUser = {
        id: `user-${Date.now()}`,
        name,
        email,
        phone: phone || undefined,
        role,
        department: department || undefined,
        status: 'active',
        createdAt: new Date(),
        lastLogin: undefined,
      };
      mutateLocalUsers((prev) => [user, ...prev]);
      toast.success('Usuário criado localmente.');
    } else {
      try {
        await createUser({
          name,
          email,
          password: '12345678',
          role: (role?.toUpperCase() as UserRole) ?? 'AGENT',
        });
        await refetch();
      } catch (error) {
        return;
      }
    }

    setIsCreateDialogOpen(false);
  };

  const handleUpdateUser = async (user: UIUser, partial: Partial<UIUser>) => {
    const updatedUser: UIUser = { ...user, ...partial };

    if (isFallback) {
      mutateLocalUsers((prev) => prev.map((item) => (item.id === user.id ? updatedUser : item)));
      toast.success('Usuário atualizado localmente.');
      setEditingUser(null);
      return;
    }

    try {
      await updateUser({
        id: user.id,
        data: {
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role.toUpperCase() as UserRole,
          isActive: updatedUser.status === 'active',
        },
      });
      setEditingUser(null);
      await refetch();
    } catch (error) {
      /* handled by hook */
    }
  };

  const handleDeleteUser = async (user: UIUser) => {
    if (isFallback) {
      mutateLocalUsers((prev) => prev.filter((item) => item.id !== user.id));
      toast.success('Usuário removido localmente.');
      return;
    }

    try {
      await deleteUser(user.id);
      await refetch();
    } catch (error) {
      /* handled by hook */
    }
  };

  const roleStats = useMemo(() => ({
    admin: userSource.filter((u) => u.role === 'admin').length,
    manager: userSource.filter((u) => u.role === 'manager').length,
    agent: userSource.filter((u) => u.role === 'agent').length,
    viewer: userSource.filter((u) => u.role === 'viewer').length,
  }), [userSource]);

  const departmentOptions = useMemo(() => {
    const set = new Set<string>();
    userSource.forEach((user) => {
      if (user.department) {
        set.add(user.department.toLowerCase());
      }
    });
    return Array.from(set);
  }, [userSource]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold">Usuários & Times</h1>
          <p className="text-muted-foreground">
            Gerencie usuários, permissões e controle de acesso
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Cadastrar novo usuário</DialogTitle>
              </DialogHeader>
              <form className="space-y-6" onSubmit={handleCreateUser}>
                <div className="flex justify-center">
                  <AvatarUpload
                    fallback="U"
                    onUpload={(file) => {
                      console.log('Avatar uploaded:', file);
                      toast.success('Foto carregada com sucesso!');
                    }}
                    size="lg"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome *</Label>
                    <Input id="name" name="name" placeholder="Nome completo" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail *</Label>
                    <Input id="email" name="email" type="email" placeholder="usuario@empresa.com" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" name="phone" placeholder="(00) 90000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Função</Label>
                    <Select name="role" defaultValue="agent">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="agent">Agente</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="department">Departamento</Label>
                    <Input id="department" name="department" placeholder="Equipe ou setor" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    Criar Usuário
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Estatísticas Gerais</CardTitle>
          <CardDescription>Resumo dos membros ativos por função</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(roleStats).map(([role, count]) => {
            const info = ROLE_LABELS[role as UIUser['role']];
            const Icon = info.icon;
            return (
              <Card key={role} className="border-dashed">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{info.label}</p>
                    <p className="text-2xl font-bold">{count}</p>
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Filtros</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar usuários..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                <SelectItem value="admin">Administradores</SelectItem>
                <SelectItem value="manager">Gerentes</SelectItem>
                <SelectItem value="agent">Agentes</SelectItem>
                <SelectItem value="viewer">Visualizadores</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Departamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os departamentos</SelectItem>
                {departmentOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary">
              <Filter className="mr-2 h-4 w-4" />
              Avançado
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
            <CardDescription>
              {filteredUsers.length} usuário(s) encontrados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading && filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Carregando usuários...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
            ) : (
              filteredUsers.map((user) => {
                const info = ROLE_LABELS[user.role];
                const Icon = info.icon;
                const isSelected = user.id === selectedUserId;

                return (
                  <motion.div
                    key={user.id}
                    whileHover={{ scale: 1.01 }}
                    className={`rounded-lg border p-4 transition-shadow ${
                      isSelected ? 'border-primary shadow-sm' : 'hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedUserId(user.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-1 gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar} />
                          <AvatarFallback>
                            {user.name
                              .split(' ')
                              .map((word) => word[0])
                              .join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-lg font-semibold">{user.name}</h3>
                            <Badge className={`${info.badge}`}>{info.label}</Badge>
                            <Badge className={STATUS_BADGES[user.status]}>
                              {user.status === 'active'
                                ? 'Ativo'
                                : user.status === 'inactive'
                                ? 'Inativo'
                                : 'Pendente'}
                            </Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="h-4 w-4" /> {user.email}
                            </span>
                            {user.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-4 w-4" /> {user.phone}
                              </span>
                            )}
                            {user.department && (
                              <span className="flex items-center gap-1">
                                <Settings className="h-4 w-4" /> {user.department}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" /> Último acesso: {formatLastLogin(user.lastLogin)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingUser(user);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteUser(user);
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
            <CardTitle>Detalhes do Usuário</CardTitle>
            <CardDescription>
              {selectedUser ? 'Informações completas do colaborador' : 'Selecione um usuário'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={selectedUser.avatar} />
                    <AvatarFallback>
                      {selectedUser.name
                        .split(' ')
                        .map((word) => word[0])
                        .join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedUser.name}</h3>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Função</span>
                    <Badge className={ROLE_LABELS[selectedUser.role].badge}>
                      {ROLE_LABELS[selectedUser.role].label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge className={STATUS_BADGES[selectedUser.status]}>
                      {selectedUser.status === 'active'
                        ? 'Ativo'
                        : selectedUser.status === 'inactive'
                        ? 'Inativo'
                        : 'Pendente'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify_between">
                    <span className="text-muted-foreground">Criado em</span>
                    <span>{selectedUser.createdAt.toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Departamento</span>
                    <span>{selectedUser.department ?? 'Não informado'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Último acesso</span>
                    <span>{formatLastLogin(selectedUser.lastLogin)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Selecione um usuário para visualizar detalhes.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleUpdateUser(editingUser, editingUser);
              }}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Nome</Label>
                  <Input
                    id="edit-name"
                    value={editingUser.name}
                    onChange={(element) =>
                      setEditingUser((prev) => prev && { ...prev, name: element.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">E-mail</Label>
                  <Input
                    id="edit-email"
                    value={editingUser.email}
                    onChange={(element) =>
                      setEditingUser((prev) => prev && { ...prev, email: element.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">Telefone</Label>
                  <Input
                    id="edit-phone"
                    value={editingUser.phone ?? ''}
                    onChange={(element) =>
                      setEditingUser((prev) => prev && { ...prev, phone: element.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select
                    value={editingUser.role}
                    onValueChange={(value: UIUser['role']) =>
                      setEditingUser((prev) => prev && { ...prev, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="manager">Gerente</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                      <SelectItem value="viewer">Visualizador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-department">Departamento</Label>
                <Input
                  id="edit-department"
                  value={editingUser.department ?? ''}
                  onChange={(element) =>
                    setEditingUser((prev) => prev && { ...prev, department: element.target.value })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Status</Label>
                <Switch
                  checked={editingUser.status === 'active'}
                  onCheckedChange={(checked) =>
                    setEditingUser((prev) =>
                      prev && { ...prev, status: checked ? 'active' : 'inactive' },
                    )
                  }
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isUpdating}>
                  Salvar alterações
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
