import { IgApiClient } from 'instagram-private-api';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';

interface InstagramSession {
  client: IgApiClient;
  connectionId: string;
  username: string;
}

const toPlainObject = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as Record<string, any>) } : {};

class InstagramProvider {
  private sessions: Map<string, InstagramSession> = new Map();

  async connect(connectionId: string, credentials: { username: string; password: string }) {
    let latestConfig: Record<string, any> = {};
    try {
      logger.info({ connectionId, username: credentials.username }, 'Connecting to Instagram');

      const existing = await prisma.connections.findUnique({
        where: { id: connectionId },
        select: { config: true },
      });
      latestConfig = toPlainObject(existing?.config);

      const ig = new IgApiClient();
      ig.state.generateDevice(credentials.username);

      // Login
      await ig.account.login(credentials.username, credentials.password);

      // Store session
      this.sessions.set(connectionId, {
        client: ig,
        connectionId,
        username: credentials.username
      });

      // Update connection status
      latestConfig = {
        ...latestConfig,
        username: credentials.username,
        userId: ig.state.cookieUserId,
        error: undefined,
      };

      await prisma.connections.update({
        where: { id: connectionId },
        data: { 
          status: 'CONNECTED',
          config: latestConfig,
          updated_at: new Date(),
        }
      });

      // Get account info
      const accountInfo = await ig.account.currentUser();
      await redis.set(`instagram:${connectionId}:accounts`, JSON.stringify([{
        id: accountInfo.pk,
        username: accountInfo.username,
        fullName: accountInfo.full_name,
        profilePicUrl: accountInfo.profile_pic_url
      }]));

      logger.info({ connectionId, username: credentials.username }, '✅ Instagram connected');

      return ig;
    } catch (error: any) {
      logger.error({ error: error.message, connectionId }, 'Instagram connection failed');
      
      latestConfig = {
        ...latestConfig,
        error: error.message,
      };

      await prisma.connections.update({
        where: { id: connectionId },
        data: { 
          status: 'ERROR',
          config: latestConfig
        }
      });

      throw error;
    }
  }

  async sendDirectMessage(connectionId: string, recipientUsername: string, message: string) {
    const session = this.sessions.get(connectionId);
    if (!session) {
      throw new Error('Instagram session not found');
    }

    try {
      // Get user ID from username
      const userId = await session.client.user.getIdByUsername(recipientUsername);
      
      // Send direct message
      const thread = session.client.entity.directThread([userId.toString()]);
      await thread.broadcastText(message);

      logger.info({ connectionId, to: recipientUsername }, 'Instagram DM sent');

      return { success: true };
    } catch (error: any) {
      logger.error({ error: error.message }, 'Failed to send Instagram DM');
      throw error;
    }
  }

  async disconnect(connectionId: string) {
    const session = this.sessions.get(connectionId);
    if (session) {
      try {
        this.sessions.delete(connectionId);
        
        await prisma.connections.update({
          where: { id: connectionId },
          data: { status: 'DISCONNECTED', updated_at: new Date() }
        });

        logger.info({ connectionId }, 'Instagram disconnected');
      } catch (error) {
        logger.error({ error }, 'Error disconnecting Instagram');
      }
    }
  }

  isConnected(connectionId: string): boolean {
    return this.sessions.has(connectionId);
  }
}

export const instagramProvider = new InstagramProvider();
