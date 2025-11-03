import { io, Socket } from 'socket.io-client';

const resolveWsUrl = () => {
  const envUrl = import.meta.env.VITE_WS_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  return 'ws://localhost:3001';
};

const WS_URL = resolveWsUrl();
const WS_PATH = import.meta.env.VITE_WS_PATH?.trim() || '/socket.io';

class SocketClient {
  private socket: Socket | null = null;

  connect(token: string) {
    if (this.socket?.connected) return this.socket;

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      path: WS_PATH,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
    });

    this.socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }

  emit(event: string, data?: any) {
    this.socket?.emit(event, data);
  }

  get connected() {
    return this.socket?.connected || false;
  }
}

export const socketClient = new SocketClient();
