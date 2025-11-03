import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import { emitToUser } from '../lib/socket.js';

type JsonRecord = Record<string, unknown>;

const QUEUE_KEY = 'scheduled_campaigns_queue';

export const scheduledCampaignsController = {
  async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    const where: JsonRecord = { userId: userId };
    if (status) {
      where.status = status;
    }

    const [items, total] = await prisma.$transaction([
      prisma.scheduled_campaigns.findMany({
        where,
        orderBy: { scheduledAt: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.scheduled_campaigns.count({ where }),
    ]);

    res.json({
      data: items,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  },

  async get(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { campaignId } = req.params;

    const campaign = await prisma.scheduled_campaigns.findFirst({
      where: { id: campaignId, userId: userId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    res.json({ data: campaign });
  },

  async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const {
      name,
      description,
      integrationId,
      scheduledAt,
      contacts,
      messages,
      delaySeconds = 5,
      simulateTyping = true,
      simulateRecording = false,
    } = req.body;

    if (!name || !scheduledAt) {
      return res.status(400).json({ error: 'Nome e data agendada são obrigatórios' });
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos um contato' });
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Informe ao menos uma mensagem' });
    }

    const campaign = await prisma.scheduled_campaigns.create({
      data: {
        userId: userId,
        integrationId: integrationId ?? null,
        name,
        description,
        scheduledAt: new Date(scheduledAt),
        contacts,
        messagesPayload: messages,
        delaySeconds: Number(delaySeconds),
        simulateTyping: Boolean(simulateTyping),
        simulateRecording: Boolean(simulateRecording),
        stats: { sent: 0, failed: 0, total: contacts.length },
      },
    });

    await enqueueCampaign(campaign.id, campaign.scheduledAt);

    logger.info({ campaignId: campaign.id }, 'Scheduled campaign created');

    res.status(201).json({
      message: 'Campanha programada criada com sucesso',
      data: campaign,
    });
  },

  async update(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { campaignId } = req.params;
    const updates = req.body as JsonRecord;

    const existing = await prisma.scheduled_campaigns.findFirst({
      where: { id: campaignId, userId: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    if (existing.status !== 'scheduled' && existing.status !== 'paused') {
      return res.status(400).json({ error: 'Somente campanhas agendadas ou pausadas podem ser atualizadas' });
    }

    const updated = await prisma.scheduled_campaigns.update({
      where: { id: campaignId },
      data: {
        name: updates.name ?? existing.name,
        description: updates.description ?? existing.description,
        scheduledAt: updates.scheduledAt ? new Date(String(updates.scheduledAt)) : existing.scheduledAt,
        contacts: Array.isArray(updates.contacts) ? updates.contacts : existing.contacts,
        messagesPayload: Array.isArray(updates.messages) ? updates.messages : existing.messagesPayload,
        delaySeconds: updates.delaySeconds ?? existing.delaySeconds,
        simulateTyping: updates.simulateTyping ?? existing.simulateTyping,
        simulateRecording: updates.simulateRecording ?? existing.simulateRecording,
        integrationId: updates.integrationId ?? existing.integrationId,
        updatedAt: new Date(),
      },
    });

    if (updates.scheduledAt) {
      await enqueueCampaign(updated.id, updated.scheduledAt);
    }

    res.json({ message: 'Campanha atualizada', data: updated });
  },

  async remove(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { campaignId } = req.params;

    const existing = await prisma.scheduled_campaigns.findFirst({
      where: { id: campaignId, userId: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    await prisma.scheduled_campaigns.delete({ where: { id: campaignId } });
    await redis.zrem(QUEUE_KEY, campaignId);

    res.status(204).send();
  },

  async startNow(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { campaignId } = req.params;

    const campaign = await prisma.scheduled_campaigns.findFirst({
      where: { id: campaignId, userId: userId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    await prisma.scheduled_campaigns.update({
      where: { id: campaignId },
      data: { status: 'running', updatedAt: new Date() },
    });

    await redis.publish('campaign:execute', JSON.stringify({ campaignId }));

    res.json({ message: 'Execução iniciada', data: campaign });
  },

  async pause(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { campaignId } = req.params;

    const campaign = await prisma.scheduled_campaigns.findFirst({
      where: { id: campaignId, userId: userId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    if (campaign.status !== 'running' && campaign.status !== 'scheduled') {
      return res.status(400).json({ error: 'Apenas campanhas em execução ou agendadas podem ser pausadas' });
    }

    await prisma.scheduled_campaigns.update({
      where: { id: campaignId },
      data: { status: 'paused', updatedAt: new Date() },
    });

    await redis.zrem(QUEUE_KEY, campaignId);
    emitToUser(userId, 'campaign:paused', { campaignId });

    res.json({ message: 'Campanha pausada' });
  },

  async resume(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { campaignId } = req.params;

    const campaign = await prisma.scheduled_campaigns.findFirst({
      where: { id: campaignId, userId: userId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    if (campaign.status !== 'paused') {
      return res.status(400).json({ error: 'A campanha não está pausada' });
    }

    await prisma.scheduled_campaigns.update({
      where: { id: campaignId },
      data: { status: 'scheduled', updatedAt: new Date() },
    });

    await enqueueCampaign(campaign.id, campaign.scheduledAt);

    res.json({ message: 'Campanha retomada' });
  },

  async cancel(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { campaignId } = req.params;

    const campaign = await prisma.scheduled_campaigns.findFirst({
      where: { id: campaignId, userId: userId },
    });

    if (!campaign) {
      return res.status(404).json({ error: 'Campanha não encontrada' });
    }

    await prisma.scheduled_campaigns.update({
      where: { id: campaignId },
      data: { status: 'cancelled', updatedAt: new Date() },
    });

    await redis.zrem(QUEUE_KEY, campaignId);
    emitToUser(userId, 'campaign:cancelled', { campaignId });

    res.json({ message: 'Campanha cancelada' });
  },
};

async function enqueueCampaign(campaignId: string, scheduledAt: Date | null) {
  if (!scheduledAt) return;

  const score = scheduledAt.getTime();
  await redis.zadd(QUEUE_KEY, score, campaignId);
}
