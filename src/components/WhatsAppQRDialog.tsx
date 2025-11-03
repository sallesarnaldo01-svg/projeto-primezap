import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Smartphone,
  Wifi,
} from 'lucide-react';
import { whatsappService } from '@/services/whatsapp';
import QRCode from 'qrcode';
import { toast } from 'sonner';

interface WhatsAppQRDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId?: string;
  onConnected?: () => void;
}

interface DeviceInfo {
  phone?: string;
  device?: string;
}

type ViewState = 'loading' | 'qr' | 'connected' | 'error';

const extractErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null) {
    const maybeError = error as {
      response?: { data?: { message?: string; error?: string } };
      message?: string;
    };

    return (
      maybeError.response?.data?.message ??
      maybeError.response?.data?.error ??
      maybeError.message ??
      'Erro ao carregar QR Code'
    );
  }

  return 'Erro ao carregar QR Code';
};

export function WhatsAppQRDialog({
  open,
  onOpenChange,
  connectionId,
  onConnected,
}: WhatsAppQRDialogProps) {
  const [qrCode, setQrCode] = useState('');
  const [status, setStatus] = useState<ViewState>('loading');
  const [error, setError] = useState('');
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({});
  const [lastQrAt, setLastQrAt] = useState<number>(0);

  useEffect(() => {
    if (!open) {
      setQrCode('');
      setStatus('loading');
      setError('');
      setDeviceInfo({});
      return;
    }

    if (!connectionId) {
      setStatus('error');
      setError('Conexão não encontrada');
      return;
    }

    let interval: NodeJS.Timeout | undefined;
    let qrRefresh: NodeJS.Timeout | undefined;

    const start = async () => {
      await loadQRCode();
      interval = setInterval(checkStatus, 2000);
      // Enquanto exibindo QR, fazer refresh automático próximo ao vencimento do QR (~60s)
      qrRefresh = setInterval(() => {
        if (status === 'qr') {
          const age = Date.now() - lastQrAt;
          if (age > 55_000) {
            void loadQRCode();
          }
        }
      }, 10_000);
    };

    start().catch((err) => {
      console.error('Failed to start QR watcher', err);
    });

    return () => {
      if (interval) clearInterval(interval);
      if (qrRefresh) clearInterval(qrRefresh);
    };
  }, [open, connectionId]);

  const loadQRCode = async () => {
    if (!connectionId) return;

    setStatus('loading');
    setError('');

    try {
      const connection = await whatsappService.getConnectionStatus(connectionId);
      if (connection.status === 'CONNECTED') {
        setStatus('connected');
        setDeviceInfo({
          phone: connection.phone,
          device: connection.device ?? connection.provider,
        });
        toast.success('WhatsApp já está conectado!');
        onConnected?.();
        setTimeout(() => onOpenChange(false), 1500);
        return;
      }
    } catch (error) {
      console.debug('Não foi possível obter status antes do QR', error);
    }

    let qrPayload: string | null = null;

    try {
      qrPayload = await whatsappService.waitForQrCode(connectionId, {
        timeoutMs: 60_000,
        intervalMs: 1_500,
      });
    } catch (pollError) {
      console.warn('QR polling falhou; tentando endpoint legado', pollError);
      try {
        const legacy = await whatsappService.getQRCode(connectionId);

        if (legacy.status === 'CONNECTED') {
          setStatus('connected');
          try {
            const latest = await whatsappService.getConnectionStatus(connectionId);
            setDeviceInfo({
              phone: latest.phone,
              device: latest.device ?? latest.provider,
            });
          } catch (statusError) {
            console.debug('Falha ao atualizar status pós QR', statusError);
          }
          toast.success('WhatsApp conectado com sucesso!');
          onConnected?.();
          setTimeout(() => onOpenChange(false), 2000);
          return;
        }

        qrPayload = legacy.qrCode;
      } catch (legacyError) {
        console.error('Fallback do QR também falhou', legacyError);
        const message =
          pollError instanceof Error ? pollError.message : extractErrorMessage(pollError);
        setStatus('error');
        setError(message);
        toast.error('Erro ao carregar QR Code');
        return;
      }
    }

    if (!qrPayload) {
      setStatus('error');
      setError('QR Code não disponível. Tente novamente em instantes.');
      return;
    }

    let formatted = qrPayload;
    try {
      if (!qrPayload.startsWith('data:image') && !qrPayload.startsWith('data:application')) {
        // Providers como Baileys retornam texto do QR (não imagem/base64). Geramos uma imagem localmente.
        formatted = await QRCode.toDataURL(qrPayload, { width: 256, margin: 1 });
      }
      setQrCode(formatted);
      setLastQrAt(Date.now());
    } catch (qrErr) {
      console.warn('Falha ao formatar QR como imagem; exibindo payload bruto', qrErr);
      setQrCode(`data:image/png;base64,${qrPayload}`);
      setLastQrAt(Date.now());
    }
    setStatus('qr');
  };

  const checkStatus = async () => {
    if (!connectionId) return;

    try {
      const connection = await whatsappService.getConnectionStatus(connectionId);

      if (connection.status === 'CONNECTED') {
        setStatus('connected');
        setDeviceInfo({
          phone: connection.phone,
          device: connection.device ?? connection.provider,
        });
        toast.success('WhatsApp conectado com sucesso!');
        onConnected?.();
        setTimeout(() => onOpenChange(false), 2000);
      }
    } catch (err) {
      console.debug('WhatsApp status polling failed', err);
    }
  };

  const renderInstructions = () => (
    <Card className="bg-muted/50 border-dashed">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-medium">Como conectar:</p>
        <ol className="text-xs text-muted-foreground space-y-2">
          <li>
            <span className="font-semibold mr-1">1.</span>
            Abra o WhatsApp no seu celular
          </li>
          <li>
            <span className="font-semibold mr-1">2.</span>
            Toque em "Aparelhos conectados"
          </li>
          <li>
            <span className="font-semibold mr-1">3.</span>
            Escolha "Conectar um aparelho"
          </li>
          <li>
            <span className="font-semibold mr-1">4.</span>
            Aponte a câmera para este QR Code
          </li>
        </ol>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code com o aplicativo WhatsApp no seu celular
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6 space-y-6">
          {status === 'loading' && (
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Gerando QR Code via provedor</p>
              <Badge variant="outline" className="bg-muted/30">
                <Wifi className="h-3 w-3 mr-1" />
                Inicializando conexão segura
              </Badge>
            </div>
          )}

          {status === 'qr' && (
            <div className="space-y-5 w-full">
              <Card>
                <CardContent className="p-4 flex items-center justify-center">
                  <div className="bg-white p-4 rounded-lg shadow-sm">
                    <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
                  </div>
                </CardContent>
              </Card>
              {renderInstructions()}
              <div className="flex items-center justify-between w-full">
                <Badge variant="secondary" className="gap-2">
                  <Smartphone className="h-3 w-3" />
                  Aguardando leitura
                </Badge>
                <Button onClick={loadQRCode} variant="outline" size="sm" className="gap-2">
                  <QrCode className="h-4 w-4" />
                  Atualizar QR Code
                </Button>
              </div>
            </div>
          )}

          {status === 'connected' && (
            <div className="space-y-4 text-center w-full">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto animate-pulse" />
              <p className="text-lg font-semibold text-green-600">Conectado com sucesso!</p>
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Smartphone className="h-4 w-4" />
                      Número
                    </span>
                    <span className="font-mono font-semibold">
                      {deviceInfo.phone ?? 'Carregando...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Wifi className="h-4 w-4" />
                      Dispositivo
                    </span>
                    <span className="font-semibold">
                      {deviceInfo.device ?? 'WhatsApp Web'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 text-center w-full">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
              <Alert variant="destructive">
                <AlertDescription>{error || 'Ocorreu um erro ao carregar o QR Code'}</AlertDescription>
              </Alert>
              <Button onClick={loadQRCode} variant="outline" className="gap-2">
                <QrCode className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
