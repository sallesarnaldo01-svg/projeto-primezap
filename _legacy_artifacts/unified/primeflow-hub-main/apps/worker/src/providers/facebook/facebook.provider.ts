import login from 'facebook-chat-api';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

interface FacebookSession {
  api: any;
  connectionId: string;
}

const toPlainObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};

class FacebookProvider {
  private sessions: Map<string, FacebookSession> = new Map();

  async connect(connectionId: string, credentials: { email: string; password: string }) {
    try {
      logger.info({ connectionId }, 'Connecting to Facebook');

      const existing = await prisma.connections.findUnique({
        where: { id: connectionId },
        select: { config: true },
      });

      let latestConfig = toPlainObject(existing?.config);

      return new Promise((resolve, reject) => {
        login({ email: credentials.email, password: credentials.password }, async (err, api) => {
          if (err) {
            logger.error({ error: err }, 'Facebook login error');
            latestConfig = {
              ...latestConfig,
              error: err.message,
            };

            await prisma.connections.update({
              where: { id: connectionId },
              data: { status: 'ERROR', config: latestConfig }
            });
            return reject(err);
          }

          // Store session
          this.sessions.set(connectionId, { api, connectionId });

          latestConfig = {
            ...latestConfig,
            email: credentials.email,
            error: undefined,
          };

          // Update connection status
          await prisma.connections.update({
            where: { id: connectionId },
            data: { status: 'CONNECTED', config: latestConfig, updated_at: new Date() }
          });

          // Get user pages
          api.getThreadList(20, null, [], (err: any, threads: any[]) => {
            if (!err && threads) {
              const pages = threads.map(t => ({
                id: t.threadID,
                name: t.name,
                type: t.isGroup ? 'group' : 'user'
              }));
              redis.set(`facebook:${connectionId}:pages`, JSON.stringify(pages));
            }
          });

          // Listen for messages
          api.listenMqtt((err: any, message: any) => {
            if (err) return;
            this.handleIncomingMessage(connectionId, message);
          });

          logger.info({ connectionId }, '✅ Facebook connected');
          resolve(api);
        });
      });
    } catch (error) {
      logger.error({ error, connectionId }, 'Facebook connection failed');
      throw error;
    }
  }

  async sendMessage(connectionId: string, recipientId: string, message: string) {
    const session = this.sessions.get(connectionId);
    if (!session) {
      throw new Error('Facebook session not found');
    }

    return new Promise((resolve, reject) => {
      session.api.sendMessage(message, recipientId, (err: any, messageInfo: any) => {
        if (err) {
          logger.error({ error: err }, 'Failed to send Facebook message');
          return reject(err);
        }
        resolve(messageInfo);
      });
    });
  }

  async disconnect(connectionId: string) {
    const session = this.sessions.get(connectionId);
    if (session) {
      try {
        session.api.logout();
        this.sessions.delete(connectionId);
        
        await prisma.connections.update({
          where: { id: connectionId },
          data: { status: 'DISCONNECTED', updated_at: new Date() }
        });

        logger.info({ connectionId }, 'Facebook disconnected');
      } catch (error) {
        logger.error({ error }, 'Error disconnecting Facebook');
      }
    }
  }

  private async handleIncomingMessage(connectionId: string, message: any) {
    try {
      const connection = await prisma.connections.findUnique({
        where: { id: connectionId },
        include: { tenants: true }
      });

      if (!connection) return;

      // Log message
      await prisma.messageLog.create({
        data: {
          tenantId: connection.tenant_id,
          channel: 'FACEBOOK',
          direction: 'IN',
          contact: message.senderID,
          payload: {
            messageId: message.messageID,
            threadId: message.threadID,
            body: message.body,
            attachments: message.attachments
          }
        }
      });

      logger.info({ 
        connectionId, 
        from: message.senderID 
      }, 'Facebook message received');
    } catch (error) {
      logger.error({ error }, 'Error handling Facebook message');
    }
  }

  isConnected(connectionId: string): boolean {
    return this.sessions.has(connectionId);
  }
}

export const facebookProvider = new FacebookProvider();
