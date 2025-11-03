import path from 'node:path';
import { mkdirSync } from 'node:fs';
import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  WASocket,
  fetchLatestBaileysVersion,
  downloadMediaMessage,
  proto,
  AnyMessageContent
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { MessageProvider, SendMessageOptions, MessageContent } from '../message.provider.js';
import { ConnectionType } from '@primeflow/shared/types';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { supabase } from '../../lib/supabase.js';
import { extension as extensionFromMime, lookup as mimeLookup } from 'mime-types';
import { randomUUID } from 'node:crypto';

interface ConnectionContext {
  socket: WASocket;
  meta: Record<string, unknown>;
}

interface IncomingMessagePayload {
  connectionId: string;
  from: string;
  content: MessageContent;
  timestamp: Date;
}

type MessageCallback = (payload: IncomingMessagePayload) => void;

const toJsonObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};

export class BaileysProvider implements MessageProvider {
  type = ConnectionType.WHATSAPP;
  private connections = new Map<string, ConnectionContext>();
  private messageCallbacks: MessageCallback[] = [];

  async connect(connectionId: string, config: any): Promise<void> {
    if (this.connections.has(connectionId)) {
      logger.warn({ connectionId }, 'Baileys connection already exists');
      return;
    }

    try {
      const authRoot = config?.authDir ?? path.resolve('./.baileys-auth');
      mkdirSync(authRoot, { recursive: true });
      const authPath = path.join(authRoot, connectionId);

      const existingConnection = await prisma.connections.findUnique({
        where: { id: connectionId },
        select: { config: true }
      });

      let latestMeta: Record<string, unknown> = toJsonObject(existingConnection?.config);

      await prisma.connections.update({
        where: { id: connectionId },
        data: { status: 'CONNECTING' }
      }).catch((error) => {
        logger.warn({ connectionId, error }, 'Failed to mark Baileys connection as CONNECTING');
      });

      const { state, saveCreds } = await useMultiFileAuthState(authPath);
      const { version } = await fetchLatestBaileysVersion();

      const socket = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'error' }),
        markOnlineOnConnect: false,
        browser: ['Primeflow', 'Firefox', '1.0']
      });

      this.connections.set(connectionId, {
        socket,
        meta: latestMeta
      });

      socket.ev.on('creds.update', saveCreds);

      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          latestMeta = {
            ...latestMeta,
            qrCode: qr
          };

          await prisma.connections.update({
            where: { id: connectionId },
            data: {
              status: 'CONNECTING',
              config: latestMeta,
              updated_at: new Date()
            }
          }).catch((error) => {
            logger.error({ connectionId, error }, 'Failed to store QR for Baileys connection');
          });

          await redis.setex(`qr:${connectionId}`, 120, qr).catch((error) => {
            logger.error({ connectionId, error }, 'Failed to cache Baileys QR code in Redis');
          });
        }

        if (connection === 'open') {
          const hostJid = socket.authState.creds.me?.id;
          const phone = hostJid?.split(':')[0]?.replace(/\D/g, '');
          latestMeta = {
            ...latestMeta,
            phone,
            device: 'Baileys'
          };

          if ('qrCode' in latestMeta) {
            delete latestMeta.qrCode;
          }

          await prisma.connections.update({
            where: { id: connectionId },
            data: {
              status: 'CONNECTED',
              phone: phone ?? null,
              config: latestMeta,
              updated_at: new Date()
            }
          }).catch((error) => {
            logger.error({ connectionId, error }, 'Failed to mark Baileys connection as CONNECTED');
          });

          await redis.del(`qr:${connectionId}`).catch((error) => {
            logger.warn({ connectionId, error }, 'Failed to clear Baileys QR cache');
          });

          logger.info({ connectionId }, 'Baileys WhatsApp connected');
        } else if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          logger.warn({ connectionId, shouldReconnect, statusCode }, 'Baileys connection closed');

          if (!shouldReconnect) {
            this.connections.delete(connectionId);

            await prisma.connections.update({
              where: { id: connectionId },
              data: { status: 'DISCONNECTED' }
            }).catch((error) => {
              logger.warn({ connectionId, error }, 'Failed to mark Baileys connection as DISCONNECTED');
            });
          } else {
            setTimeout(() => {
              this.connect(connectionId, config).catch((error) => {
                logger.error({ connectionId, error }, 'Failed to reconnect Baileys');
              });
            }, 2000);
          }
        }
      });

      socket.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
          if (msg.key.fromMe) continue;

          const content: MessageContent = {};

          if (msg.message?.conversation) {
            content.text = msg.message.conversation;
          } else if (msg.message?.extendedTextMessage) {
            content.text = msg.message.extendedTextMessage.text;
          } else if (msg.message?.imageMessage) {
            const media = await saveIncomingMedia(connectionId, socket, msg);
            content.image = {
              url: media?.url ?? '',
              caption: msg.message.imageMessage.caption
            };
          } else if (msg.message?.videoMessage) {
            const media = await saveIncomingMedia(connectionId, socket, msg);
            content.video = {
              url: media?.url ?? '',
              caption: msg.message.videoMessage.caption
            };
          } else if (msg.message?.audioMessage) {
            const media = await saveIncomingMedia(connectionId, socket, msg);
            content.audio = {
              url: media?.url ?? '',
              ptt: msg.message.audioMessage.ptt ?? undefined
            };
          } else if (msg.message?.documentMessage) {
            const media = await saveIncomingMedia(connectionId, socket, msg);
            content.document = {
              url: media?.url ?? '',
              filename: msg.message.documentMessage.fileName ?? media?.fileName
            };
          }

          this.messageCallbacks.forEach((callback) =>
            callback({
              connectionId,
              from: msg.key.remoteJid!,
              content,
              timestamp: new Date(Number(msg.messageTimestamp ?? Date.now()) * 1000)
            })
          );
        }
      });
    } catch (error) {
      this.connections.delete(connectionId);

      await prisma.connections.update({
        where: { id: connectionId },
        data: { status: 'ERROR' }
      }).catch(() => {});

      logger.error({ connectionId, error }, 'Failed to connect Baileys');
      throw error;
    }
  }

  async disconnect(connectionId: string): Promise<void> {
    const context = this.connections.get(connectionId);
    if (!context) return;

    try {
      await context.socket.logout();
    } catch (error) {
      logger.warn({ connectionId, error }, 'Failed to logout Baileys connection');
    }

    this.connections.delete(connectionId);

    await prisma.connections.update({
      where: { id: connectionId },
      data: { status: 'DISCONNECTED' }
    }).catch((error) => {
      logger.warn({ connectionId, error }, 'Failed to mark Baileys connection as DISCONNECTED');
    });

    await redis.del(`qr:${connectionId}`).catch((error) => {
      logger.warn({ connectionId, error }, 'Failed to clear Baileys QR cache on disconnect');
    });

    logger.info({ connectionId }, 'Baileys WhatsApp disconnected');
  }

  async isConnected(connectionId: string): Promise<boolean> {
    const context = this.connections.get(connectionId);
    if (!context) return false;

    return Boolean(context.socket.authState.creds?.me);
  }

  async sendMessage(options: SendMessageOptions): Promise<{ messageId: string }> {
    const context = this.connections.get(options.connectionId);
    if (!context) {
      throw new Error('Connection not found');
    }

    const jid = buildBaileysJid(options.to);
    const { socket } = context;
    let payload: AnyMessageContent | null = null;

    if (options.content.text) {
      payload = { text: options.content.text };
    } else if (options.content.image) {
      payload = {
        image: { url: options.content.image.url },
        caption: options.content.image.caption
      };
    } else if (options.content.audio) {
      payload = {
        audio: { url: options.content.audio.url },
        ptt: options.content.audio.ptt ?? false,
        mimetype: 'audio/mpeg'
      } as AnyMessageContent;
    } else if (options.content.video) {
      payload = {
        video: { url: options.content.video.url },
        caption: options.content.video.caption
      };
    } else if (options.content.document) {
      const fileName = options.content.document.filename ?? 'document';
      payload = {
        document: { url: options.content.document.url },
        fileName,
        mimetype: resolveMimeType(fileName)
      } as AnyMessageContent;
    } else if (options.content.buttons && options.content.buttons.length > 0) {
      const buttonsText = [
        options.content.text ?? 'Selecione uma opção:',
        ...options.content.buttons.map((button, index) => `${index + 1}. ${button.label}`)
      ].join('\n');
      payload = { text: buttonsText };
    } else {
      throw new Error('No content to send');
    }

    const result = await socket.sendMessage(jid, payload);

    return { messageId: result.key.id! };
  }

  onMessage(callback: MessageCallback): void {
    this.messageCallbacks.push(callback);
  }
}

interface SavedMediaResult {
  url: string | null;
  mimeType?: string;
  fileName?: string;
}

async function saveIncomingMedia(
  connectionId: string,
  socket: WASocket,
  message: proto.IWebMessageInfo
): Promise<SavedMediaResult | null> {
  try {
    const content = message.message;
    if (!content) {
      return null;
    }

    const mimeType =
      content.imageMessage?.mimetype ??
      content.videoMessage?.mimetype ??
      content.audioMessage?.mimetype ??
      content.documentMessage?.mimetype ??
      'application/octet-stream';

    const buffer = await downloadMediaMessage(
      message,
      'buffer',
      {},
      {
        logger: logger as any,
        reuploadRequest: socket.updateMediaMessage
      }
    );

    const extensionFromName =
      content.documentMessage?.fileName?.split('.').pop();
  const extension =
      extensionFromName ??
      (mimeType ? extensionFromMime(mimeType) ?? null : null) ??
      'bin';

    const fileName = [
      'whatsapp',
      connectionId,
      `${Date.now()}_${randomUUID()}.${extension}`
    ].join('/');

    const bucket = supabase.storage.from('media');

    const { error: uploadError } = await bucket.upload(fileName, buffer, {
      contentType: mimeType ?? 'application/octet-stream',
      upsert: true
    });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicData } = bucket.getPublicUrl(fileName);
    const publicUrl = publicData?.publicUrl ?? null;

    return {
      url: publicUrl,
      mimeType,
      fileName
    };
  } catch (error) {
    logger.error({ error, connectionId }, 'Failed to store incoming media');
    return null;
  }
}

function resolveMimeType(fileName: string): string {
  const detected = mimeLookup(fileName);
  return typeof detected === 'string' && detected.length > 0
    ? detected
    : 'application/octet-stream';
}

export const baileysProvider = new BaileysProvider();

function buildBaileysJid(raw: string): string {
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

  return `${digits}@s.whatsapp.net`;
}
