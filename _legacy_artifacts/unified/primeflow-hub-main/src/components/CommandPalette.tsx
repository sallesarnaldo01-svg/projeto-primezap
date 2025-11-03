import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
  MessageCircle,
  BarChart3,
  Users,
  Phone,
  FileText,
  Plus,
  Search,
} from "lucide-react";

/**
 * Grupos de comandos exibidos no palette
 */
const commands = [
  {
    group: "Navegação",
    items: [
      { id: "dashboard", label: "Dashboard", icon: BarChart3, path: "/dashboard" },
      { id: "conversas", label: "Conversas", icon: MessageCircle, path: "/conversas" },
      { id: "crm", label: "CRM", icon: Users, path: "/crm" },
      { id: "funil", label: "Funil de Vendas", icon: BarChart3, path: "/funil" },
      { id: "kanban", label: "Kanban", icon: FileText, path: "/kanban" },
      { id: "scrum", label: "Scrum", icon: FileText, path: "/scrum" },
      { id: "agendamentos", label: "Agendamentos", icon: Calendar, path: "/agendamentos" },
      { id: "conexoes", label: "Conexões", icon: Phone, path: "/conexoes" },
    ],
  },
  {
    group: "Ações Rápidas",
    items: [
      { id: "new-contact", label: "Novo Contato", icon: User, action: "new-contact" },
      { id: "new-deal", label: "Nova Oportunidade", icon: CreditCard, action: "new-deal" },
      { id: "new-task", label: "Nova Tarefa", icon: Plus, action: "new-task" },
      { id: "new-appointment", label: "Novo Agendamento", icon: Calendar, action: "new-appointment" },
    ],
  },
  {
    group: "Configurações",
    items: [
      { id: "settings", label: "Configurações", icon: Settings, path: "/configuracoes" },
      { id: "profile", label: "Perfil", icon: User, action: "profile" },
      { id: "help", label: "Ajuda", icon: Smile, path: "/ajuda" },
    ],
  },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Componente principal do Command Palette
 * Protege o uso de useNavigate e impede navegação fora do Router
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();

  const rotaValida = useCallback((path: string) => {
    if (!path || typeof path !== "string") return false;
    return commands.flatMap((g) => g.items).some((i) => i.path === path);
  }, []);

  const handleSelect = useCallback(
    (value: string) => {
      const command = commands.flatMap((g) => g.items).find((i) => i.id === value);
      if (!command) return;

      try {
        if (command.path) {
          if (rotaValida(command.path)) {
            navigate(command.path);
          } else {
            console.warn("[CommandPalette] rota inválida:", command.path);
          }
        } else if (command.action) {
          console.log("Action:", command.action);
          switch (command.action) {
            case "new-contact":
              // abrir modal ou lógica de novo contato
              break;
            case "new-deal":
              // abrir modal de nova oportunidade
              break;
            case "new-task":
              break;
            case "new-appointment":
              break;
            case "profile":
              // abrir configurações de perfil
              break;
            default:
              console.warn("Ação desconhecida:", command.action);
          }
        }
      } catch (e) {
        console.error("[CommandPalette] erro ao navegar:", e);
      }

      onOpenChange(false);
    },
    [navigate, onOpenChange, rotaValida]
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Digite um comando ou pesquise..." />
      <CommandList>
        <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        {commands.map((group) => (
          <div key={group.group}>
            <CommandGroup heading={group.group}>
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={handleSelect}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/**
 * Hook global para abrir o palette com Ctrl+K
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return { open, setOpen };
}
