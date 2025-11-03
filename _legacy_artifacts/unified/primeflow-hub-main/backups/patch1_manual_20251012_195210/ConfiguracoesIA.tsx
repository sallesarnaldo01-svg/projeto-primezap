import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import {
  Bot,
  Edit,
  Plus,
  Rocket,
  ShieldCheck,
  Trash2,
  Wand2,
  AlertTriangle,
  CloudLightning,
} from 'lucide-react';
import { SystemPromptEditor } from '@/components/ai/SystemPromptEditor';
import { useAIAgent } from '@/hooks/useAIAgent';
import type { AIAgent, CreateAIAgentPayload, UpdateAIAgentPayload } from '@/services/aiAgents';
import { cn } from '@/lib/utils';

interface DraftAgent extends Omit<CreateAIAgentPayload, 'systemPrompt'> {
  id?: string;
  systemPrompt: string;
  status: 'active' | 'inactive' | 'draft';
}

const DEFAULT_DRAFT: DraftAgent = {
  name: '',
  description: '',
  provider: 'openai',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  topP: 0.9,
  systemPrompt: '',
  instructions: '',
  tags: [],
  status: 'draft',
};

const SECURITY_POLICIES = [
  'Mascarar telefones e documentos sensíveis automaticamente.',
  'Registrar histórico de prompts e respostas críticas.',
  'Bloquear envio de dados pessoais para integrações externas sem consentimento.',
  'Escalonar para humano quando detectar linguagem abusiva ou sentimentos negativos extremos.',
];

const PROVIDERS = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'Google', value: 'google' },
  { label: 'Anthropic', value: 'anthropic' },
  { label: 'Azure', value: 'azure-openai' },
];

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ['gpt-4o-mini', 'gpt-4.1', 'gpt-4o'],
  google: ['gemini-1.5-pro', 'gemini-1.5-flash'],
  anthropic: ['claude-3-sonnet', 'claude-3-haiku'],
  'azure-openai': ['gpt-4o-mini', 'gpt-35-turbo'],
};

export default function ConfiguracoesIA() {
  const { agents, isFallback, createAgent, updateAgent, deleteAgent } = useAIAgent();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<DraftAgent>(DEFAULT_DRAFT);
  const [autoPilotEnabled, setAutoPilotEnabled] = useState(true);
  const [safeModeEnabled, setSafeModeEnabled] = useState(true);
  const [streamingEnabled, setStreamingEnabled] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  const activeAgents = useMemo(() => agents.filter((agent) => agent.status === 'active'), [agents]);
  const draftAgents = useMemo(() => agents.filter((agent) => agent.status === 'draft'), [agents]);

  const totalAgents = agents.length;

  const systemLoad = useMemo(() => {
    if (totalAgents === 0) return 0;
    const active = activeAgents.length;
    if (!streamingEnabled) return Math.max(15, active * 10);
    return Math.min(95, active * 18 + (autoPilotEnabled ? 12 : 0));
  }, [activeAgents.length, autoPilotEnabled, streamingEnabled, totalAgents]);

  const handleOpenDialog = (agent?: AIAgent) => {
    if (agent) {
      setDraft({
        id: agent.id,
        name: agent.name,
        description: agent.description ?? '',
        provider: agent.provider,
        model: agent.model,
        temperature: agent.temperature,
        topP: agent.topP,
        systemPrompt: agent.systemPrompt,
        instructions: agent.instructions ?? '',
        tags: agent.tags ?? [],
        status: agent.status,
      });
      setSelectedAgentId(agent.id);
    } else {
      setDraft(DEFAULT_DRAFT);
      setSelectedAgentId(null);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!draft.name.trim()) {
      return;
    }
    const payload: CreateAIAgentPayload | UpdateAIAgentPayload = {
      name: draft.name.trim(),
      description: draft.description?.trim() || undefined,
      provider: draft.provider,
      model: draft.model,
      temperature: draft.temperature,
      topP: draft.topP,
      systemPrompt: draft.systemPrompt.trim(),
      instructions: draft.instructions?.trim() || undefined,
      tags: draft.tags?.length ? draft.tags : undefined,
    };

    if (selectedAgentId) {
      await updateAgent({ id: selectedAgentId, data: { ...payload, status: draft.status } });
    } else {
      const created = await createAgent(payload as CreateAIAgentPayload);
      setSelectedAgentId(created.id);
    }
    setDialogOpen(false);
    setDraft(DEFAULT_DRAFT);
  };

  const handleDelete = async (agentId: string) => {
    await deleteAgent(agentId);
    if (selectedAgentId === agentId) {
      setSelectedAgentId(null);
    }
  };

  const temperaturePercentage = Math.round((draft.temperature ?? 0) * 100);
  const coverage = activeAgents.length === 0 ? 0 : Math.min(100, activeAgents.length * 18);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div className="flex flex-col gap-4 justify-between md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-bold">Configurações de IA</h1>
          <p className="text-muted-foreground">
            Ajuste agentes, prompts e políticas de segurança utilizados na automação da PrimeZapAI.
          </p>
        </div>
        <div className="flex gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Novo agente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{selectedAgentId ? 'Editar agente' : 'Criar agente'}</DialogTitle>
                <DialogDescription>
                  Defina parâmetros de modelo, prompt do sistema e políticas do agente virtual.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Nome</Label>
                    <Input
                      id="agent-name"
                      value={draft.name}
                      onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Agente Comercial"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-provider">Provedor</Label>
                    <select
                      id="agent-provider"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={draft.provider}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          provider: event.target.value,
                          model: MODELS_BY_PROVIDER[event.target.value]?.[0] ?? prev.model,
                        }))
                      }
                    >
                      {PROVIDERS.map((provider) => (
                        <option key={provider.value} value={provider.value}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-model">Modelo</Label>
                    <select
                      id="agent-model"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={draft.model}
                      onChange={(event) =>
                        setDraft((prev) => ({
                          ...prev,
                          model: event.target.value,
                        }))
                      }
                    >
                      {(MODELS_BY_PROVIDER[draft.provider] ?? [draft.model]).map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Temperatura</Label>
                    <Slider
                      min={0}
                      max={100}
                      step={1}
                      value={[temperaturePercentage]}
                      onValueChange={([next]) =>
                        setDraft((prev) => ({ ...prev, temperature: (next ?? 0) / 100 }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Criatividade: <span className="font-medium">{temperaturePercentage}%</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent-description">Descrição</Label>
                  <Textarea
                    id="agent-description"
                    rows={3}
                    value={draft.description}
                    onChange={(event) =>
                      setDraft((prev) => ({ ...prev, description: event.target.value }))
                    }
                    placeholder="Ex.: Agente especialista em qualificação de leads e follow-up automático."
                  />
                </div>

                <SystemPromptEditor
                  value={draft.systemPrompt}
                  onChange={(systemPrompt) => setDraft((prev) => ({ ...prev, systemPrompt }))}
                  helperText="Use parágrafos curtos, organize as instruções por tópicos e inclua exemplos de respostas ideais."
                />
              </div>

              <DialogFooter className="flex justify-between gap-3">
                {selectedAgentId ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => selectedAgentId && handleDelete(selectedAgentId)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remover agente
                  </Button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleSave}>
                    Salvar
                  </Button>
                </div>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="secondary" onClick={() => setAutoPilotEnabled((prev) => !prev)}>
            <Rocket className="mr-2 h-4 w-4" />
            {autoPilotEnabled ? 'Autopilot ativo' : 'Ativar Autopilot'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Agentes ativos"
          icon={Bot}
          value={activeAgents.length}
          helper={`${totalAgents} agentes cadastrados`}
        />
        <SummaryCard
          title="Cobertura automática"
          icon={Wand2}
          value={`${coverage}%`}
          helper="Canalização de atendimentos automatizados"
        />
        <SummaryCard
          title="Modo seguro"
          icon={ShieldCheck}
          value={safeModeEnabled ? 'Ligado' : 'Desligado'}
          helper="Sanitização de dados confidenciais"
          badge={isFallback ? 'Fallback ativo' : undefined}
          badgeTint="warning"
        />
        <SummaryCard
          title="Carga estimada"
          icon={CloudLightning}
          value={`${systemLoad}%`}
          helper="Consumo médio nos últimos 10 minutos"
          badge={streamingEnabled ? 'Streaming' : 'Polling'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Orquestração de IA</CardTitle>
          <CardDescription>
            Configure como os agentes interagem com canais, follow-ups e automações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <ConfigToggle
              title="Autopilot"
              description="Permite que o agente assuma conversas automaticamente quando padrões forem detectados."
              value={autoPilotEnabled}
              onChange={setAutoPilotEnabled}
            />
            <ConfigToggle
              title="Modo seguro"
              description="Mascara dados sensíveis, aplica políticas LGPD e solicita confirmação antes de integrações externas."
              value={safeModeEnabled}
              onChange={setSafeModeEnabled}
            />
            <ConfigToggle
              title="Streaming de respostas"
              description="Envia tokens conforme gerados pelo modelo, melhorando a percepção de velocidade para o usuário."
              value={streamingEnabled}
              onChange={setStreamingEnabled}
            />
          </div>

          <Tabs defaultValue="ativos" className="space-y-4">
            <TabsList>
              <TabsTrigger value="ativos">Ativos</TabsTrigger>
              <TabsTrigger value="rascunho">Rascunho</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
            </TabsList>

            <TabsContent value="ativos" className="space-y-3">
              {activeAgents.length === 0 ? (
                <EmptyState />
              ) : (
                activeAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} onEdit={() => handleOpenDialog(agent)} />
                ))
              )}
            </TabsContent>

            <TabsContent value="rascunho" className="space-y-3">
              {draftAgents.length === 0 ? (
                <EmptyState message="Nenhum agente em rascunho. Crie um novo ou converta um existente." />
              ) : (
                draftAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} onEdit={() => handleOpenDialog(agent)} />
                ))
              )}
            </TabsContent>

            <TabsContent value="todos" className="space-y-3">
              {agents.length === 0 ? (
                <EmptyState />
              ) : (
                agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} onEdit={() => handleOpenDialog(agent)} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Políticas de segurança e governança</CardTitle>
          <CardDescription>
            Reforce as diretrizes de utilização da IA em toda a organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {SECURITY_POLICIES.map((policy) => (
            <div key={policy} className="flex gap-3 rounded-lg border border-dashed border-muted p-3">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <p className="text-sm text-muted-foreground">{policy}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {isFallback && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            API de agentes indisponível
          </div>
          <p className="mt-1">
            Estamos exibindo dados de demonstração enquanto a API de agentes não está acessível. Assim
            que o serviço voltar, os agentes reais serão carregados automaticamente.
          </p>
        </div>
      )}
    </motion.div>
  );
}

interface SummaryCardProps {
  title: string;
  value: string | number;
  helper: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
  badgeTint?: 'warning' | 'success' | 'danger';
}

const SummaryCard = ({ title, value, helper, icon: Icon, badge, badgeTint = 'success' }: SummaryCardProps) => (
  <Card>
    <CardContent className="flex items-center justify-between p-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
          {badge && (
            <Badge
              variant="secondary"
              className={cn(
                'text-[10px]',
                badgeTint === 'warning' && 'bg-amber-50 text-amber-700',
                badgeTint === 'danger' && 'bg-rose-50 text-rose-700',
              )}
            >
              {badge}
            </Badge>
          )}
        </div>
        <div className="text-3xl font-semibold">{value}</div>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>
      <Icon className="h-10 w-10 text-primary" />
    </CardContent>
  </Card>
);

const ConfigToggle = ({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) => (
  <div className="flex items-start justify-between rounded-lg border border-dashed border-muted p-4">
    <div className="pr-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
    <Switch checked={value} onCheckedChange={onChange} />
  </div>
);

const EmptyState = ({ message = 'Nenhum agente configurado ainda.' }: { message?: string }) => (
  <div className="flex items-center gap-2 rounded-lg border border-dashed border-muted p-4 text-sm text-muted-foreground">
    <Bot className="h-4 w-4" />
    {message}
  </div>
);

const AgentCard = ({ agent, onEdit }: { agent: AIAgent; onEdit: () => void }) => (
  <div className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{agent.name}</span>
        <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>{agent.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{agent.description ?? 'Sem descrição'}</p>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span className="rounded-full border border-dashed border-muted px-2 py-1">
          Provider: {agent.provider}
        </span>
        <span className="rounded-full border border-dashed border-muted px-2 py-1">
          Modelo: {agent.model}
        </span>
        <span className="rounded-full border border-dashed border-muted px-2 py-1">
          Temperatura: {(agent.temperature * 100).toFixed(0)}%
        </span>
        {agent.tags?.map((tag) => (
          <span key={tag} className="rounded-full border border-dashed border-muted px-2 py-1">
            #{tag}
          </span>
        ))}
      </div>
    </div>
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onEdit}>
        <Edit className="mr-2 h-4 w-4" />
        Configurar
      </Button>
    </div>
  </div>
);
