import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const aiSettingsController = {
  async getConfiguration(req: Request, res: Response) {
    const userId = req.user!.userId;

    const config = await prisma.ai_configurations.findFirst({
      where: { user_id: userId },
    });

    res.json({ data: config ?? null });
  },

  async upsertConfiguration(req: Request, res: Response) {
    const userId = req.user!.userId;
    const {
      provider,
      model,
      apiKey,
      enabled = true,
      autoReply = false,
      sentimentAnalysis = false,
      suggestionEnabled = false,
      config = {},
    } = req.body;

    if (!provider || !model || !apiKey) {
      return res.status(400).json({ error: 'provider, model e apiKey são obrigatórios' });
    }

    const updated = await prisma.ai_configurations.upsert({
      where: { user_id: userId },
      update: {
        provider,
        model,
        api_key: apiKey,
        enabled,
        auto_reply: autoReply,
        sentiment_analysis: sentimentAnalysis,
        suggestion_enabled: suggestionEnabled,
        config,
        updated_at: new Date(),
      },
      create: {
        user_id: userId,
        provider,
        model,
        api_key: apiKey,
        enabled,
        auto_reply: autoReply,
        sentiment_analysis: sentimentAnalysis,
        suggestion_enabled: suggestionEnabled,
        config,
      },
    });

    res.json({ message: 'Configuração atualizada', data: updated });
  },

  async deleteConfiguration(req: Request, res: Response) {
    const userId = req.user!.userId;

    await prisma.ai_configurations.deleteMany({
      where: { user_id: userId },
    });

    res.status(204).send();
  },

  async listAutoReplies(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { conversationId, limit = 50, offset = 0 } = req.query;

    const where: Record<string, unknown> = { user_id: userId };
    if (conversationId) where.conversation_id = conversationId;

    const replies = await prisma.ai_auto_replies.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      skip: Number(offset),
    });

    res.json({ data: replies });
  },
};
