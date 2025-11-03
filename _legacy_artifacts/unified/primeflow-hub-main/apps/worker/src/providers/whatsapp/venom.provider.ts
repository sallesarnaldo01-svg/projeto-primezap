import venom, { Whatsapp, Message } from 'venom-bot';
import { MessageProvider, SendMessageOptions, MessageContent } from '../message.provider.js';
import { ConnectionType } from '@primeflow/shared/types';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { EventEmitter } from 'events';
import { redis } from '../../lib/redis.js';

const toJsonObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};

interface IncomingMessagePayload {
  connectionId: string;
  from: string;
  content: MessageContent;
  timestamp: Date;
}

type MessageCallback = (payload: IncomingMessagePayload) => void;

export class VenomProvider implements MessageProvider {
  type = ConnectionType.WHATSAPP;
  private clients = new Map<string, Whatsapp>();
  private messageCallbacks: MessageCallback[] = [];
  private qrEmitter = new EventEmitter();

  async connect(connectionId: string, config: any): Promise<void> {
    if (this.clients.has(connectionId)) {
      logger.warn({ connectionId }, 'Venom connection already exists');
      return;
    }

    try {
      logger.info({ connectionId }, 'Starting Venom connection');

      const existingConnection = await prisma.connections.findUnique({
        where: { id: connectionId },
        select: { config: true }
      });

      let latestConfig: Record<string, unknown> = toJsonObject(existingConnection?.config);

      await prisma.connections.update({
        where: { id: connectionId },
        data: { status: 'CONNECTING' }
      }).catch((error) => {
        logger.warn({ connectionId, error }, 'Failed to mark connection as CONNECTING');
      });

      const client = await venom.create(
        connectionId,
        async (base64Qr) => {
          logger.info({ connectionId }, 'QR Code generated');
          this.qrEmitter.emit(`qr:${connectionId}`, base64Qr);
          
          // Update connection with QR code
          latestConfig = {
            ...latestConfig,
            qrCode: base64Qr
          };

          prisma.connections.update({
            where: { id: connectionId },
            data: {
              status: 'CONNECTING',
              config: latestConfig,
              updated_at: new Date()
            }
          }).catch(err => logger.error({ error: err }, 'Failed to update QR'));

          await redis.setex(`qr:${connectionId}`, 120, base64Qr).catch((error) => {
            logger.error({ connectionId, error }, 'Failed to cache QR code in Redis');
          });
        },
        (statusSession) => {
          logger.info({ connectionId, status: statusSession }, 'Session status');
        },
        {
          headless: 'new',
          useChrome: false,
          debug: false,
          logQR: false,
          browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
          ],
          autoClose: 60000,
        }
      );

      // Connection established
      let hostDevice: any = null;
      try {
        hostDevice = await client.getHostDevice();
      } catch (error) {
        logger.warn({ connectionId, error }, 'Failed to retrieve host device information');
      }

      latestConfig = {
        ...latestConfig,
        phone: hostDevice?.id?.user,
        device: hostDevice?.platform
      };

      if ('qrCode' in latestConfig) {
        delete latestConfig.qrCode;
      }

      await prisma.connections.update({
        where: { id: connectionId },
        data: {
          status: 'CONNECTED',
          phone: hostDevice?.id?.user ?? null,
          config: latestConfig,
          updated_at: new Date()
        }
      });

      await redis.del(`qr:${connectionId}`).catch((error) => {
        logger.warn({ connectionId, error }, 'Failed to delete cached QR code');
      });

      logger.info({ connectionId }, 'Venom WhatsApp connected');

      // Listen for incoming messages
      client.onMessage((message: Message) => {
        if (message.isGroupMsg) return;
        if (message.fromMe) return;

        const content: MessageContent = {};

        if (message.type === 'chat') {
          content.text = message.body;
        } else if (message.type === 'image') {
          content.image = {
            url: message.body,
            caption: message.caption
          };
        } else if (message.type === 'audio' || message.type === 'ptt') {
          content.audio = {
            url: message.body,
            ptt: message.type === 'ptt'
          };
        } else if (message.type === 'video') {
          content.video = {
            url: message.body,
            caption: message.caption
          };
        } else if (message.type === 'document') {
          content.document = {
            url: message.body,
            filename: message.filename
          };
        }

        this.messageCallbacks.forEach(cb => cb({
          connectionId,
          from: message.from,
          content,
          timestamp: new Date(message.timestamp * 1000)
        }));
      });

      this.clients.set(connectionId, client);
    } catch (error) {
      logger.error({ connectionId, error }, 'Failed to connect Venom');
      
      await prisma.connections.update({
        where: { id: connectionId },
        data: { status: 'ERROR' }
      }).catch(() => {});
      
      throw error;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const client = this.clients.get(connectionId);
    if (client) {
      await client.close();
      this.clients.delete(connectionId);
      
      await prisma.connections.update({
        where: { id: connectionId },
        data: { status: 'DISCONNECTED' }
      });

      await redis.del(`qr:${connectionId}`).catch((error) => {
        logger.warn({ connectionId, error }, 'Failed to delete cached QR code on disconnect');
      });
      
      logger.info({ connectionId }, 'Venom WhatsApp disconnected');
    }
  }

  async isConnected(connectionId: string): Promise<boolean> {
    const client = this.clients.get(connectionId);
    if (!client) return false;
    
    try {
      const state = await client.getConnectionState();
      return state === 'CONNECTED';
    } catch {
      return false;
    }
  }

  async sendMessage(options: SendMessageOptions): Promise<{ messageId: string }> {
    const client = this.clients.get(options.connectionId);
    
    if (!client) {
      throw new Error('Connection not found');
    }

    const chatId = buildChatId(options.to);

    let result;

    try {
      if (options.content.text) {
        result = await client.sendText(chatId, options.content.text);
      } else if (options.content.image) {
        result = await client.sendImage(
          chatId,
          options.content.image.url,
          'image',
          options.content.image.caption || ''
        );
      } else if (options.content.audio) {
        result = await client.sendVoice(chatId, options.content.audio.url);
      } else if (options.content.video) {
        result = await client.sendVideoAsGif(
          chatId,
          options.content.video.url,
          'video',
          options.content.video.caption || ''
        );
      } else if (options.content.document) {
        result = await client.sendFile(
          chatId,
          options.content.document.url,
          options.content.document.filename || 'document',
          ''
        );
      } else if (options.content.buttons) {
        result = await client.sendText(
          chatId,
          options.content.text || 'Escolha uma opção:'
        );
      } else {
        throw new Error('No content to send');
      }

      const messageId = extractMessageId(result);

      logger.info({ connectionId: options.connectionId, to: chatId, messageId }, 'Message sent via Venom');
      
      return { messageId };
    } catch (error) {
      logger.error({ error, connectionId: options.connectionId }, 'Failed to send message');
      throw error;
    }
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }

  onQRCode(connectionId: string, callback: (qr: string) => void): void {
    this.qrEmitter.on(`qr:${connectionId}`, callback);
  }

  removeQRListener(connectionId: string): void {
    this.qrEmitter.removeAllListeners(`qr:${connectionId}`);
  }
}

export const venomProvider = new VenomProvider();

function buildChatId(raw: string): string {
  if (!raw) {
    throw new Error('Recipient number is required');
  }

  const trimmed = raw.trim();
  if (trimmed.includes('@')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Recipient number is invalid');
  }

  return `${digits}@c.us`;
}

function extractMessageId(result: any): string {
  if (!result) {
    return '';
  }

  if (typeof result === 'string') {
    return result;
  }

  return result.id || result.messageId || result.key?.id || '';
}
