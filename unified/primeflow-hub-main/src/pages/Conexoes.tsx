import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WhatsAppQRDialog } from '@/components/WhatsAppQRDialog';
import { MultiChannelComposer } from '@/components/MultiChannelComposer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSocket } from '@/hooks/useSocket';
import api from '@/lib/api';
import { whatsappService } from '@/services/whatsapp';
import { toast } from 'sonner';
const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      response?: { data?: { message?: string; error?: string } };
      message?: string;
    };

    return (
      maybeError.response?.data?.message ??
      maybeError.response?.data?.error ??
      maybeError.message ??
      fallback
    );
  }

  return fallback;
};

import {
  Phone,
  MessageCircle,
  Hash,
  QrCode,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Smartphone,
  Globe,
  RefreshCw,
  Settings,
  Activity,
  Instagram,
  Send,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
  Plus,
  ShieldAlert,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Platform = 'whatsapp' | 'facebook' | 'instagram';
type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending';

interface Integration {
  id: string;
  platform: Platform;
  name: string;
  status: IntegrationStatus;
  phone_number?: string;
  access_token?: string;
  phone_number_id?: string;
  business_account_id?: string;
  page_id?: string;
  instagram_account_id?: string;
  last_sync_at?: string;
  created_at: string;
  updated_at: string;
  error?: string;
}

type FormState = {
  name: string;
  access_token: string;
  phone_number_id: string;
  business_account_id: string;
  page_id: string;
  instagram_account_id: string;
};

const initialFormState: FormState = {
  name: '',
  access_token: '',
  phone_number_id: '',
  business_account_id: '',
  page_id: '',
  instagram_account_id: '',
};

const PROVIDER_META: Record<
  Platform,
  {
    name: string;
    icon: LucideIcon;
    color: string;
    bgColor: string;
    features: string[];
  }
> = {
  whatsapp: {
    name: 'WhatsApp Business',
    icon: Phone,
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    features: ['Mensagens', 'Mídia', 'Etiquetas', 'Status'],
  },
  facebook: {
    name: 'Facebook Pages',
    icon: MessageCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    features: ['Mensagens', 'Comentários', 'Posts'],
  },
  instagram: {
    name: 'Instagram Business',
    icon: Hash,
    color: 'text-pink-600',
    bgColor: 'bg-pink-50',
    features: ['Direct', 'Comentários', 'Stories'],
  },
};

const STATUS_META: Record<
  IntegrationStatus,
  { label: string; icon: LucideIcon; color: string }
> = {
  active: { label: 'Conectado', icon: CheckCircle, color: 'text-green-600' },
  inactive: { label: 'Inativo', icon: XCircle, color: 'text-muted-foreground' },
  error: { label: 'Erro', icon: ShieldAlert, color: 'text-red-600' },
  pending: { label: 'Aguardando', icon: Activity, color: 'text-yellow-600' },
};

const formatLastSync = (lastSync?: string) => {
  if (!lastSync) return 'Nunca sincronizado';
  try {
    return new Date(lastSync).toLocaleString('pt-BR');
  } catch {
    return lastSync;
  }
};

const getIntegrationTitle = (integration: Integration, fallback: string) => {
  return integration.name?.trim() || integration.phone_number || fallback;
};

const getStatusMeta = (status: IntegrationStatus) =>
  STATUS_META[status] ?? STATUS_META.inactive;

export default function Conexoes() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('');
  const [showComposer, setShowComposer] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(null);
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [initiatingWhatsApp, setInitiatingWhatsApp] = useState(false);
  const socket = useSocket();

  const loadIntegrations = useCallback(
    async (showRefreshSpinner = false) => {
      if (loading) {
        setLoading(true);
      } else if (showRefreshSpinner) {
        setRefreshing(true);
      }

      try {
        const response = await api.get<Integration[]>('/integrations');
        setIntegrations(response.data ?? []);
      } catch (error) {
        console.error('Failed to load integrations', error);
        toast.error('Erro ao carregar integrações');
      } finally {
        if (loading) {
          setLoading(false);
        }
        if (showRefreshSpinner) {
          setRefreshing(false);
        }
      }
    },
    [loading]
  );

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  useEffect(() => {
    if (!socket) return;

    const handleStatus = () => {
      loadIntegrations(true);
    };

    socket.on('connection:status', handleStatus);

    return () => {
      socket.off('connection:status', handleStatus);
    };
  }, [socket, loadIntegrations]);

  const whatsappIntegrations = useMemo(
    () => integrations.filter((integration) => integration.platform === 'whatsapp'),
    [integrations]
  );

  const connectedCount = integrations.filter(
    (integration) => integration.status === 'active'
  ).length;
  const inactiveCount = integrations.filter(
    (integration) => integration.status === 'inactive'
  ).length;
  const errorCount = integrations.filter(
    (integration) => integration.status === 'error'
  ).length;

  const integrationsByProvider = useMemo(() => {
    return (['whatsapp', 'facebook', 'instagram'] as Platform[]).reduce(
      (acc, provider) => {
        acc[provider] = integrations.filter(
          (integration) => integration.platform === provider
        );
        return acc;
      },
      {} as Record<Platform, Integration[]>
    );
  }, [integrations]);

  const openModal = (platform: Platform) => {
    setSelectedPlatform(platform);
    setFormData(initialFormState);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPlatform(null);
    setFormData(initialFormState);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPlatform) return;

    setSavingIntegration(true);

    try {
      await api.post('/integrations', {
        platform: selectedPlatform,
        ...formData,
      });
      toast.success('Integração adicionada com sucesso');
      await loadIntegrations(true);
      closeModal();
    } catch (error) {
      console.error('Failed to create integration', error);
      const message = getErrorMessage(
        error,
        'Erro ao criar integração. Verifique os dados e tente novamente.'
      );
      toast.error(message);
    } finally {
      setSavingIntegration(false);
    }
  };

  const handleTestIntegration = async (id: string) => {
    setTestingId(id);
    try {
      const response = await api.post<{ success: boolean; message?: string }>(
        `/integrations/${id}/test`
      );
      if (response.data.success) {
        toast.success('Conexão testada com sucesso!');
      } else {
        toast.error(response.data.message || 'Erro ao testar a integração');
      }
    } catch (error) {
      console.error('Failed to test integration', error);
      const message = getErrorMessage(error, 'Erro ao testar integração.');
      toast.error(message);
    } finally {
      setTestingId(null);
    }
  };

  const handleSyncIntegration = async (id: string) => {
    setSyncingId(id);
    try {
      await api.post(`/integrations/${id}/sync`);
      toast.success('Sincronização iniciada com sucesso!');
      await loadIntegrations(true);
    } catch (error) {
      console.error('Failed to sync integration', error);
      const message = getErrorMessage(error, 'Erro ao sincronizar integração.');
      toast.error(message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleRemoveIntegration = async (id: string) => {
    if (!confirm('Tem certeza de que deseja remover esta integração?')) return;

    setRemovingId(id);
    try {
      await api.delete(`/integrations/${id}`);
      toast.success('Integração removida');
      await loadIntegrations(true);
    } catch (error) {
      console.error('Failed to delete integration', error);
      const message = getErrorMessage(error, 'Erro ao remover integração.');
      toast.error(message);
    } finally {
      setRemovingId(null);
    }
  };

  const handleShowQR = (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    setQrDialogOpen(true);
  };

  const handleConnectWhatsApp = async () => {
    setInitiatingWhatsApp(true);
    try {
      const connection = await whatsappService.initiateConnection('WhatsApp Principal');
      if (connection?.id) {
        setSelectedConnectionId(connection.id);
        setQrDialogOpen(true);
      }
      toast.success('Conexão iniciada. Aguarde o QR Code...');
      await loadIntegrations(true);
    } catch (error) {
      console.error('Failed to initiate WhatsApp connection', error);
      const message = getErrorMessage(
        error,
        'Erro ao iniciar conexão WhatsApp.'
      );
      toast.error(message);
    } finally {
      setInitiatingWhatsApp(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!confirm('Deseja desconectar este WhatsApp?')) return;

    setDisconnectingId(connectionId);
    try {
      await whatsappService.disconnect(connectionId);
      toast.success('WhatsApp desconectado');
      await loadIntegrations(true);
    } catch (error) {
      console.error('Failed to disconnect WhatsApp', error);
      const message = getErrorMessage(error, 'Erro ao desconectar WhatsApp.');
      toast.error(message);
    } finally {
      setDisconnectingId(null);
    }
  };

  interface ComposerPayload {
  content: string;
  bulkContacts?: string[];
  delayBetweenMs?: number;
}

const handleSendMessage = async (data: ComposerPayload) => {
    const activeConnection = whatsappIntegrations.find(
      (integration) => integration.status === 'active'
    );

    if (!activeConnection) {
      toast.error('Nenhuma conexão WhatsApp ativa disponível');
      return;
    }

    try {
      if (data.bulkContacts && data.bulkContacts.length > 0) {
        await whatsappService.sendBulkMessages(activeConnection.id, {
          contacts: data.bulkContacts,
          message: {
            text: data.content,
          },
          delayMs: data.delayBetweenMs || 1000,
        });
      }
      setShowComposer(false);
    } catch (error) {
      console.error('Failed to send message', error);
      toast.error(getErrorMessage(error, 'Erro ao enviar mensagem'));
    }
  };

  const toggleShowToken = (id: string) => {
    setShowTokens((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Conexões</h1>
            <p className="text-muted-foreground">
              Gerencie integrações com os seus canais de comunicação
            </p>
          </div>

          <div className="flex items-center gap-3">
            {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova integração
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openModal('whatsapp')}>
                  WhatsApp Business
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openModal('facebook')}>
                  Facebook Pages
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openModal('instagram')}>
                  Instagram Business
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{connectedCount}</p>
                  <p className="text-sm text-muted-foreground">Conectados</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <XCircle className="h-8 w-8 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{inactiveCount}</p>
                  <p className="text-sm text-muted-foreground">Inativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">{errorCount}</p>
                  <p className="text-sm text-muted-foreground">Com erros</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {(Object.keys(PROVIDER_META) as Platform[]).map((provider) => {
            const meta = PROVIDER_META[provider];
            const providerIntegrations = integrationsByProvider[provider];

            if (!providerIntegrations || providerIntegrations.length === 0) {
              const PlaceholderIcon = meta.icon;
              return (
                <Card key={`${provider}-placeholder`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-lg ${meta.bgColor}`}>
                          <PlaceholderIcon className={`h-6 w-6 ${meta.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-xl">{meta.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            Nenhuma integração configurada
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <AlertDescription>
                        Configure uma nova integração para começar a se comunicar por {meta.name}.
                      </AlertDescription>
                    </Alert>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={() => openModal(provider)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar integração
                      </Button>
                      {provider === 'whatsapp' && (
                        <Button
                          variant="outline"
                          onClick={handleConnectWhatsApp}
                          disabled={initiatingWhatsApp}
                        >
                          {initiatingWhatsApp ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Iniciando...
                            </>
                          ) : (
                            <>
                              <QrCode className="h-4 w-4 mr-2" />
                              Gerar QR Code
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    <Separator />
                    <div>
                      <Label className="text-sm font-medium">Recursos disponíveis</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {meta.features.map((feature) => (
                          <Badge key={feature} variant="outline">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }

            return providerIntegrations.map((integration) => {
              const Icon = meta.icon;
              const statusMeta = getStatusMeta(integration.status);
              return (
                <Card key={integration.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className={`p-3 rounded-lg ${meta.bgColor}`}>
                          <Icon className={`h-6 w-6 ${meta.color}`} />
                        </div>
                        <div>
                          <CardTitle className="text-xl">
                            {getIntegrationTitle(integration, meta.name)}
                          </CardTitle>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <statusMeta.icon className={`h-5 w-5 ${statusMeta.color}`} />
                            <span className="text-sm text-muted-foreground">
                              {statusMeta.label}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              • Última sync: {formatLastSync(integration.last_sync_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={integration.status === 'active'}
                          disabled
                          aria-readonly
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            integration.status === 'active'
                              ? handleTestIntegration(integration.id)
                              : openModal(integration.platform)
                          }
                          disabled={
                            integration.status === 'active' && testingId === integration.id
                          }
                        >
                          {integration.status === 'active' ? (
                            <>
                              {testingId === integration.id ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4 mr-2" />
                              )}
                              {testingId === integration.id ? 'Testando...' : 'Testar'}
                            </>
                          ) : (
                            <>
                              <Settings className="h-4 w-4 mr-2" />
                              Configurar
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {integration.platform === 'whatsapp' && (
                      <div className="space-y-4">
                        {integration.status === 'active' ? (
                          <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertDescription>
                              WhatsApp conectado com sucesso.
                              {integration.phone_number && (
                                <> Número: {integration.phone_number}</>
                              )}
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <Alert variant="destructive">
                            <AlertDescription>
                              WhatsApp não está conectado. Gere um novo QR Code para conectar.
                            </AlertDescription>
                          </Alert>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                          {integration.phone_number && (
                            <div className="space-y-1">
                              <Label>Número conectado</Label>
                              <div className="flex items-center space-x-2">
                                <Smartphone className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">{integration.phone_number}</span>
                              </div>
                            </div>
                          )}
                          {integration.business_account_id && (
                            <div className="space-y-1">
                              <Label>Business Account ID</Label>
                              <div className="flex items-center space-x-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">
                                  {integration.business_account_id}
                                </span>
                              </div>
                            </div>
                          )}
                          {integration.phone_number_id && (
                            <div className="space-y-1">
                              <Label>Phone Number ID</Label>
                              <div className="flex items-center space-x-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">
                                  {integration.phone_number_id}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {integration.access_token && (
                          <div className="space-y-1">
                            <Label>Token de acesso</Label>
                            <div className="flex items-center gap-2">
                              <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted px-2 py-1 text-xs">
                                {showTokens[integration.id]
                                  ? integration.access_token
                                  : '••••••••••••••••'}
                              </code>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleShowToken(integration.id)}
                              >
                                {showTokens[integration.id] ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowQR(integration.id)}
                          >
                            <QrCode className="h-4 w-4 mr-2" />
                            QR Code
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={integration.status !== 'active'}
                            onClick={() => setShowComposer(true)}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Enviar mensagens
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncIntegration(integration.id)}
                            disabled={syncingId === integration.id}
                          >
                            {syncingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {syncingId === integration.id ? 'Sincronizando...' : 'Sincronizar'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDisconnect(integration.id)}
                            disabled={disconnectingId === integration.id}
                          >
                            {disconnectingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-2" />
                            )}
                            Desconectar
                          </Button>
                        </div>
                      </div>
                    )}

                    {integration.platform === 'facebook' && (
                      <div className="space-y-4">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            Integração com Facebook pronta para responder mensagens e comentários.
                          </AlertDescription>
                        </Alert>

                        <div className="grid gap-4 md:grid-cols-2">
                          {integration.page_id && (
                            <div className="space-y-1">
                              <Label>Page ID</Label>
                              <div className="flex items-center space-x-2">
                                <Globe className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">{integration.page_id}</span>
                              </div>
                            </div>
                          )}
                          {integration.access_token && (
                            <div className="space-y-1 md:col-span-2">
                              <Label>Access Token</Label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted px-2 py-1 text-xs">
                                  {showTokens[integration.id]
                                    ? integration.access_token
                                    : '••••••••••••••••'}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleShowToken(integration.id)}
                                >
                                  {showTokens[integration.id] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncIntegration(integration.id)}
                            disabled={syncingId === integration.id}
                          >
                            {syncingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {syncingId === integration.id ? 'Sincronizando...' : 'Sincronizar'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestIntegration(integration.id)}
                            disabled={testingId === integration.id}
                          >
                            {testingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Settings className="h-4 w-4 mr-2" />
                            )}
                            {testingId === integration.id ? 'Testando...' : 'Testar conexão'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveIntegration(integration.id)}
                            disabled={removingId === integration.id}
                          >
                            {removingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Remover
                          </Button>
                        </div>
                      </div>
                    )}

                    {integration.platform === 'instagram' && (
                      <div className="space-y-4">
                        <Alert>
                          <Instagram className="h-4 w-4" />
                          <AlertDescription>
                            Conectado ao Instagram Business para Direct e Comentários.
                          </AlertDescription>
                        </Alert>

                        <div className="grid gap-4 md:grid-cols-2">
                          {integration.instagram_account_id && (
                            <div className="space-y-1">
                              <Label>Instagram Account ID</Label>
                              <div className="flex items-center space-x-2">
                                <Instagram className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">
                                  {integration.instagram_account_id}
                                </span>
                              </div>
                            </div>
                          )}
                          {integration.access_token && (
                            <div className="space-y-1 md:col-span-2">
                              <Label>Access Token</Label>
                              <div className="flex items-center gap-2">
                                <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted px-2 py-1 text-xs">
                                  {showTokens[integration.id]
                                    ? integration.access_token
                                    : '••••••••••••••••'}
                                </code>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => toggleShowToken(integration.id)}
                                >
                                  {showTokens[integration.id] ? (
                                    <EyeOff className="h-4 w-4" />
                                  ) : (
                                    <Eye className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSyncIntegration(integration.id)}
                            disabled={syncingId === integration.id}
                          >
                            {syncingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {syncingId === integration.id ? 'Sincronizando...' : 'Sincronizar'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestIntegration(integration.id)}
                            disabled={testingId === integration.id}
                          >
                            {testingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Settings className="h-4 w-4 mr-2" />
                            )}
                            {testingId === integration.id ? 'Testando...' : 'Testar conexão'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRemoveIntegration(integration.id)}
                            disabled={removingId === integration.id}
                          >
                            {removingId === integration.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 mr-2" />
                            )}
                            Remover
                          </Button>
                        </div>
                      </div>
                    )}

                    {integration.error && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{integration.error}</AlertDescription>
                      </Alert>
                    )}

                    <Separator />
                    <div>
                      <Label className="text-sm font-medium">Recursos disponíveis</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {meta.features.map((feature) => (
                          <Badge key={`${integration.id}-${feature}`} variant="outline">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            });
          })}
        </div>

        <WhatsAppQRDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          connectionId={selectedConnectionId}
          onConnected={() => loadIntegrations(true)}
        />

        {showComposer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl space-y-2">
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setShowComposer(false)}>
                  Fechar
                </Button>
              </div>
              <MultiChannelComposer channels={['whatsapp']} onSend={handleSendMessage} />
            </div>
          </div>
        )}

        {showModal && selectedPlatform && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  Adicionar{' '}
                  {selectedPlatform === 'whatsapp'
                    ? 'WhatsApp'
                    : selectedPlatform === 'facebook'
                    ? 'Facebook'
                    : 'Instagram'}
                </h2>
                <button
                  onClick={closeModal}
                  className="text-gray-400 transition hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Nome da integração
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="Ex: WhatsApp Principal"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Access Token
                  </label>
                  <input
                    type="text"
                    value={formData.access_token}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        access_token: event.target.value,
                      }))
                    }
                    placeholder="Cole o token de acesso"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>

                {selectedPlatform === 'whatsapp' && (
                  <>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Phone Number ID
                      </label>
                      <input
                        type="text"
                        value={formData.phone_number_id}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            phone_number_id: event.target.value,
                          }))
                        }
                        placeholder="ID do número de telefone"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Business Account ID (opcional)
                      </label>
                      <input
                        type="text"
                        value={formData.business_account_id}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            business_account_id: event.target.value,
                          }))
                        }
                        placeholder="ID da conta business"
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </>
                )}

                {selectedPlatform === 'facebook' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Page ID
                    </label>
                    <input
                      type="text"
                      value={formData.page_id}
                      onChange={(event) =>
                        setFormData((prev) => ({ ...prev, page_id: event.target.value }))
                      }
                      placeholder="ID da página do Facebook"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                )}

                {selectedPlatform === 'instagram' && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Instagram Account ID
                    </label>
                    <input
                      type="text"
                      value={formData.instagram_account_id}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          instagram_account_id: event.target.value,
                        }))
                      }
                      placeholder="ID da conta do Instagram"
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-primary"
                      required
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={closeModal}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={savingIntegration}>
                    {savingIntegration ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      'Adicionar'
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
    </motion.div>
  );
}
