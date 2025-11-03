import venom, { Whatsapp, Message } from 'venom-bot';
import { MessageProvider, SendMessageOptions, MessageContent } from '../message.provider.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import { EventEmitter } from 'events';
import { redis } from '../../lib/redis.js';

const toJsonObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};

interface IncomingMessagePayload {
  connectionId: string;
  from: string;
  content: MessageContent;
  timestamp: Date;
  tenantId?: string;
  sessionName?: string;
}

type MessageCallback = (payload: IncomingMessagePayload) => void;

export class VenomProvider implements MessageProvider {
  type = 'WHATSAPP' as any;
  private clients = new Map<string, Whatsapp>();
  private messageCallbacks: MessageCallback[] = [];
  private qrEmitter = new EventEmitter();

  async connect(connectionId: string, config: any): Promise<void> {
    if (this.clients.has(connectionId)) {
      logger.warn({ connectionId }, 'Venom connection already exists');
      return;
    }

    try {
      const existingConnection = await prisma.connections.findUnique({
        where: { id: connectionId },
        select: { config: true }
      });

      const providedConfig = toJsonObject(config);
      let latestConfig: Record<string, unknown> = {
        ...toJsonObject(existingConnection?.config),
        ...providedConfig
      };

      const sessionName =
        typeof latestConfig.sessionName === 'string' && latestConfig.sessionName
          ? (latestConfig.sessionName as string)
          : connectionId;
      const tenantId =
        typeof latestConfig.tenantId === 'string' && latestConfig.tenantId
          ? (latestConfig.tenantId as string)
          : undefined;

      logger.info({ connectionId, sessionName, tenantId }, 'Starting Venom connection');
      console.info('[worker] whatsapp connect', {
        provider: 'venom',
        connectionId,
        sessionName,
        tenantId,
      });

      await prisma.connections.update({
        where: { id: connectionId },
        data: { status: 'CONNECTING' }
      }).catch((error) => {
        logger.warn({ connectionId, error }, 'Failed to mark connection as CONNECTING');
      });

      const client = await venom.create(
        connectionId,
        async (base64Qr) => {
          logger.info({ connectionId, sessionName, tenantId }, 'QR Code generated');
          console.info('[worker] qr generated', {
            provider: 'venom',
            connectionId,
            sessionName,
            tenantId,
          });
          this.qrEmitter.emit(`qr:${connectionId}`, base64Qr);
          
          // Update connection with QR code
          latestConfig = {
            ...latestConfig,
            qrCode: base64Qr,
            sessionName,
          };

          prisma.connections.update({
            where: { id: connectionId },
            data: {
              status: 'CONNECTING',
              config: latestConfig as any,
              updatedAt: new Date()
            }
          }).catch(err => logger.error({ error: err }, 'Failed to update QR'));

          const cacheKeys = Array.from(new Set([connectionId, sessionName].filter(Boolean)));
          await Promise.all(
            cacheKeys.map((key) =>
              redis.setex(`qr:${key}`, 120, base64Qr).catch((error) => {
                logger.error({ connectionId, key, error }, 'Failed to cache QR code in Redis');
              })
            )
          );
        },
        (statusSession) => {
          logger.info({ connectionId, status: statusSession }, 'Session status');
        },
        {
          headless: 'new',
          debug: true,
          logQR: true,
          browserArgs: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process'
          ],
          autoClose: 60000,
        } as any
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
        device: hostDevice?.platform,
        sessionName,
      };

      if ('qrCode' in latestConfig) {
        delete latestConfig.qrCode;
      }

      await prisma.connections.update({
        where: { id: connectionId },
        data: {
          status: 'CONNECTED',
          phone: hostDevice?.id?.user ?? null,
          config: latestConfig as any,
          updatedAt: new Date()
        }
      });

      const cacheKeys = Array.from(new Set([connectionId, sessionName].filter(Boolean)));
      await Promise.all(
        cacheKeys.map((key) =>
          redis.del(`qr:${key}`).catch((error) => {
            logger.warn({ connectionId, key, error }, 'Failed to delete cached QR code');
          })
        )
      );

      logger.info({ connectionId, sessionName, tenantId }, 'Venom WhatsApp connected');

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

        console.info('[worker] incoming message', {
          provider: 'venom',
          connectionId,
          sessionName,
          tenantId,
          from: message.from,
          to: message.to,
        });
        logger.debug({
          provider: 'venom',
          connectionId,
          sessionName,
          tenantId,
          from: message.from,
          to: message.to,
          type: message.type,
        }, 'Incoming WhatsApp message received');

        this.messageCallbacks.forEach(cb => cb({
          connectionId,
          from: message.from,
          content,
          timestamp: new Date(message.timestamp * 1000),
          tenantId,
          sessionName,
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

      const connection = await prisma.connections.findUnique({
        where: { id: connectionId },
        select: { config: true }
      });
      const config = toJsonObject(connection?.config);
      const sessionName =
        typeof config.sessionName === 'string' && config.sessionName
          ? (config.sessionName as string)
          : connectionId;
      const cacheKeys = Array.from(new Set([connectionId, sessionName].filter(Boolean)));

      await Promise.all(
        cacheKeys.map((key) =>
          redis.del(`qr:${key}`).catch((error) => {
            logger.warn({ connectionId, key, error }, 'Failed to delete cached QR code on disconnect');
          })
        )
      );
      
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
