import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores/auth';
import { useUIStore } from '@/stores/ui';
import { ProfileMenu } from '@/components/ProfileMenu';
import { 
  Sun, 
  Moon, 
  Monitor, 
  Menu, 
  Search,
  Bell,
  Settings,
  LogOut,
  User,
  HelpCircle,
  Camera,
  Lock
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';
import { api } from '@/services/api';
import { toast } from '@/components/ui/sonner';

type NotificationItem = {
  id: string;
  title?: string;
  body?: string;
  createdAt?: string;
  read?: boolean;
};

export function Header() {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuthStore();
  const { setSidebarOpen, sidebarOpen } = useUIStore();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMode, setProfileMode] = useState<'profile' | 'avatar' | 'password'>('profile');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let mounted = true;
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get<NotificationItem[]>(`/notifications`, { limit: 10 });
        if (!mounted) return;
        const arr = Array.isArray((data as any).data) ? (data as any).data : (data as any);
        setNotifications(arr as NotificationItem[]);
      } catch {
        // Silencioso em caso de 404/sem endpoint
      }
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const markAllAsRead = async () => {
    try {
      await api.post(`/notifications/mark-all-read`, {});
    } catch {
      // tolera ausência do endpoint
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    toast.success('Notificações marcadas como lidas');
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  return (
    <motion.header 
      className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="container flex h-16 items-center px-4">
        {/* Menu button for mobile */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden mr-2"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Search */}
        <div className="flex-1 flex items-center space-x-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contatos, deals, tickets... (Ctrl+K)"
              className="pl-10"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <div className="px-2 py-1 space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="text-sm text-muted-foreground p-2">Sem notificações</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="rounded-md border p-2 hover:bg-accent hover:text-accent-foreground transition-colors">
                        <p className="text-sm font-medium">{n.title || n.body || 'Notificação'}</p>
                        <p className="text-xs text-muted-foreground">{n.createdAt ? new Date(n.createdAt).toLocaleString('pt-BR') : ''}</p>
                      </div>
                    ))
                  )}
                </div>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={markAllAsRead} className="justify-center text-primary font-medium">Marcar todas como lidas</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme toggle */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {getThemeIcon()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Claro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Escuro
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                Sistema
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center space-x-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar} />
                  <AvatarFallback>
                    {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium">{user?.name || 'Usuário'}</p>
                  <p className="text-xs text-muted-foreground capitalize">{user?.role || 'agent'}</p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => {
                setProfileMode('profile');
                setProfileMenuOpen(true);
              }}>
                <User className="mr-2 h-4 w-4" />
                Meu Perfil
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setProfileMode('avatar');
                setProfileMenuOpen(true);
              }}>
                <Camera className="mr-2 h-4 w-4" />
                Trocar Foto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setProfileMode('password');
                setProfileMenuOpen(true);
              }}>
                <Lock className="mr-2 h-4 w-4" />
                Resetar Senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuItem>
                <HelpCircle className="mr-2 h-4 w-4" />
                Ajuda
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ProfileMenu 
        open={profileMenuOpen} 
        onOpenChange={setProfileMenuOpen}
        mode={profileMode}
      />
    </motion.header>
  );
}
