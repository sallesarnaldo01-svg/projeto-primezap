import api from '@/lib/api';

export interface WhatsAppConnection {
  id: string;
  status: 'CONNECTED' | 'CONNECTING' | 'DISCONNECTED' | 'ERROR';
  phone?: string;
  device?: string;
  connectedAt?: string;
  provider?: string;
  sessionName?: string;
}

export interface BulkMessageRequest {
  contacts: string[];
  message: {
    text: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'audio' | 'video' | 'document';
  };
  delayMs?: number;
}

export interface InitiateConnectionParams {
  provider?: string;
  phone?: string;
  sessionName?: string;
  webhookUrl?: string;
  name?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const whatsappService = {
  async initiateConnection(params: InitiateConnectionParams): Promise<WhatsAppConnection> {
    const { provider, phone, sessionName, webhookUrl, name } = params;

    // provider padrão via env; número de telefone passa a ser opcional
    const effectiveProvider = provider || (import.meta.env.VITE_WHATSAPP_PROVIDER as string) || 'baileys';

    const payload: Record<string, unknown> = { provider: effectiveProvider };
    if (typeof phone === 'string' && phone.trim()) payload.phone = phone.trim();
    if (sessionName) payload.sessionName = sessionName;
    if (webhookUrl) payload.webhookUrl = webhookUrl;
    if (name) payload.name = name;

    const response = await api.post<WhatsAppConnection>('/whatsapp/initiate', payload);
    return response.data;
  },

  async getQRCode(connectionId: string): Promise<{ qrCode: string; status: string }> {
    try {
      const response = await api.get<{ qr?: string; qrCode?: string; status?: string }>(
        `/whatsapp/qr/${encodeURIComponent(connectionId)}`,
        {
          validateStatus: (status) => [200, 204, 404].includes(status),
        }
      );

      if (response.status === 200) {
        return {
          qrCode: response.data.qr ?? response.data.qrCode ?? '',
          status: response.data.status ?? 'CONNECTING',
        };
      }

      if (response.status === 204) {
        return { qrCode: '', status: 'CONNECTING' };
      }
    } catch (error) {
      console.debug('Fallback to legacy QR endpoint', error);
    }

    const legacyResponse = await api.get<{ qrCode: string; status: string }>(
      `/whatsapp/${encodeURIComponent(connectionId)}/qr`
    );
    return legacyResponse.data;
  },

  async getConnectionStatus(connectionId: string): Promise<WhatsAppConnection> {
    const response = await api.get<WhatsAppConnection>(
      `/whatsapp/${encodeURIComponent(connectionId)}/status`
    );
    return response.data;
  },

  async sendBulkMessages(
    connectionId: string,
    data: BulkMessageRequest
  ): Promise<{ broadcastId: string; totalContacts: number; estimatedTime: number }> {
    const response = await api.post(
      `/whatsapp/${encodeURIComponent(connectionId)}/bulk`,
      data
    );
    return response.data;
  },

  async disconnect(connectionId: string): Promise<void> {
    await api.post(`/whatsapp/${encodeURIComponent(connectionId)}/disconnect`);
  },

  async waitForQrCode(
    sessionName: string,
    options: { timeoutMs?: number; intervalMs?: number } = {}
  ): Promise<string> {
    const timeoutMs = options.timeoutMs ?? 60_000;
    const intervalMs = options.intervalMs ?? 1_500;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      try {
      const response = await api.get<{ qr?: string; qrCode?: string }>(
        `/whatsapp/qr/${encodeURIComponent(sessionName)}`,
        {
          validateStatus: (status) => [200, 204, 304, 404].includes(status),
        }
      );

        if (response.status === 200) {
          const qr = response.data.qr ?? response.data.qrCode;
          if (qr) return qr;
        } else if (response.status === 304) {
          // Not modified; keep polling
        } else if (response.status === 404) {
          // try legacy path by id/name
          const legacy = await api.get<{ qrCode: string; status: string }>(
            `/whatsapp/${encodeURIComponent(sessionName)}/qr`,
            { validateStatus: (s) => [200, 204, 404].includes(s) }
          );
          if (legacy.status === 200 && legacy.data.qrCode) return legacy.data.qrCode;
          if (legacy.status === 404) throw new Error('QR Code não encontrado');
        }
      } catch (err) {
        // tolerate server hiccups and fallback to legacy endpoint
        try {
          const legacy = await api.get<{ qrCode: string; status: string }>(
            `/whatsapp/${encodeURIComponent(sessionName)}/qr`,
            { validateStatus: (s) => [200, 204, 404].includes(s) }
          );
          if (legacy.status === 200 && legacy.data.qrCode) return legacy.data.qrCode;
          if (legacy.status === 404) throw new Error('QR Code não encontrado');
        } catch {}
      }

      await sleep(intervalMs);
    }

    throw new Error('Timeout ao aguardar QR Code');
  },
};
