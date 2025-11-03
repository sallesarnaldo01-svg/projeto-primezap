import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AuthRequest } from '../middleware/auth.js';
import { redis } from '../lib/redis.js';

/**
 * GET /api/messages
 * Lista mensagens de uma conversa
 */
export async function getMessages(req: AuthRequest, res: Response) {
  try {
    const { conversationId, page = '1', limit = '50' } = req.query;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId é obrigatório' });
    }

    // Verificar se a conversa existe e o usuário tem acesso
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId as string }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: conversationId as string },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string),
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatar: true
            }
          }
        }
      }),
      prisma.message.count({
        where: { conversationId: conversationId as string }
      })
    ]);

    res.json({
      messages: messages.reverse(), // Inverter para ordem cronológica
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching messages');
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
}

/**
 * POST /api/messages
 * Envia uma nova mensagem
 */
export async function sendMessage(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { conversationId, content, type = 'text', mediaUrl, metadata } = req.body;

    if (!conversationId || !content) {
      return res.status(400).json({ error: 'conversationId e content são obrigatórios' });
    }

    // Verificar se a conversa existe
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true
      }
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversa não encontrada' });
    }

    // Criar mensagem
    const message = await prisma.message.create({
      data: {
        conversationId,
        content,
        type,
        mediaUrl,
        metadata: metadata || {},
        direction: 'outbound',
        status: 'pending',
        senderId: userId
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            avatar: true
          }
        }
      }
    });

    // Atualizar conversa
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessage: content.substring(0, 100)
      }
    });

    // Publicar evento para envio via webhook/API
    await redis.publish('messages:send', JSON.stringify({
      messageId: message.id,
      conversationId,
      platform: conversation.platform,
      contactPhone: conversation.contact?.phone,
      content,
      type,
      mediaUrl
    }));

    logger.info({ messageId: message.id, conversationId }, 'Message sent');
    res.status(201).json(message);
  } catch (error) {
    logger.error({ error }, 'Error sending message');
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
}

/**
 * PUT /api/messages/:id/status
 * Atualiza status de uma mensagem
 */
export async function updateMessageStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status, deliveredAt, readAt, error } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status é obrigatório' });
    }

    const validStatuses = ['pending', 'sent', 'delivered', 'read', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'status inválido' });
    }

    const message = await prisma.message.findUnique({
      where: { id }
    });

    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    const updatedMessage = await prisma.message.update({
      where: { id },
      data: {
        status,
        ...(deliveredAt && { deliveredAt: new Date(deliveredAt) }),
        ...(readAt && { readAt: new Date(readAt) }),
        ...(error && { error })
      }
    });

    // Publicar evento de atualização
    await redis.publish('messages:status', JSON.stringify({
      messageId: id,
      conversationId: message.conversationId,
      status,
      deliveredAt,
      readAt
    }));

    logger.info({ messageId: id, status }, 'Message status updated');
    res.json(updatedMessage);
  } catch (error) {
    logger.error({ error }, 'Error updating message status');
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
}

/**
 * POST /api/messages/bulk
 * Envia mensagens em massa
 */
export async function sendBulkMessages(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { contacts, content, type = 'text', mediaUrl, scheduleFor } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'contacts deve ser um array não vazio' });
    }

    if (!content) {
      return res.status(400).json({ error: 'content é obrigatório' });
    }

    // Criar campanha
    const campaign = await prisma.campaign.create({
      data: {
        name: `Envio em massa - ${new Date().toISOString()}`,
        type: 'bulk',
        status: scheduleFor ? 'SCHEDULED' : 'ACTIVE',
        userId: userId!,
        scheduledFor: scheduleFor ? new Date(scheduleFor) : null,
        totalRecipients: contacts.length
      }
    });

    // Criar mensagens para cada contato
    const messages = await Promise.all(
      contacts.map(async (contactId: string) => {
        // Buscar ou criar conversa
        let conversation = await prisma.conversation.findFirst({
          where: {
            contactId,
            userId: userId!
          }
        });

        if (!conversation) {
          conversation = await prisma.conversation.create({
            data: {
              contactId,
              userId: userId!,
              platform: 'WHATSAPP',
              status: 'active'
            }
          });
        }

        // Criar mensagem
        return prisma.message.create({
          data: {
            conversationId: conversation.id,
            content,
            type,
            mediaUrl,
            direction: 'outbound',
            status: scheduleFor ? 'scheduled' : 'pending',
            senderId: userId,
            campaignId: campaign.id
          }
        });
      })
    );

    // Se não é agendado, publicar para envio imediato
    if (!scheduleFor) {
      await redis.publish('campaigns:send', JSON.stringify({
        campaignId: campaign.id,
        messageIds: messages.map(m => m.id)
      }));
    }

    logger.info({ campaignId: campaign.id, messagesCount: messages.length }, 'Bulk messages created');
    res.status(201).json({
      campaign,
      messagesCreated: messages.length
    });
  } catch (error) {
    logger.error({ error }, 'Error sending bulk messages');
    res.status(500).json({ error: 'Erro ao enviar mensagens em massa' });
  }
}

/**
 * GET /api/messages/search
 * Busca mensagens por conteúdo
 */
export async function searchMessages(req: AuthRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const { query, conversationId, startDate, endDate, page = '1', limit = '50' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'query é obrigatório' });
    }

    const where: any = {
      content: {
        contains: query as string,
        mode: 'insensitive'
      }
    };

    if (conversationId) {
      where.conversationId = conversationId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // Filtrar por conversas do usuário
    if (userId && req.user?.role !== 'ADMIN') {
      where.conversation = {
        userId
      };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          conversation: {
            include: {
              contact: {
                select: {
                  id: true,
                  name: true,
                  phone: true
                }
              }
            }
          },
          sender: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit as string)
      }),
      prisma.message.count({ where })
    ]);

    res.json({
      messages,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });
  } catch (error) {
    logger.error({ error }, 'Error searching messages');
    res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
}

/**
 * DELETE /api/messages/:id
 * Deleta uma mensagem
 */
export async function deleteMessage(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        conversation: true
      }
    });

    if (!message) {
      return res.status(404).json({ error: 'Mensagem não encontrada' });
    }

    // Verificar permissão
    if (req.user?.role !== 'ADMIN' && message.senderId !== userId && message.conversation.userId !== userId) {
      return res.status(403).json({ error: 'Sem permissão para deletar esta mensagem' });
    }

    await prisma.message.delete({
      where: { id }
    });

    logger.info({ messageId: id }, 'Message deleted');
    res.json({ message: 'Mensagem deletada com sucesso' });
  } catch (error) {
    logger.error({ error }, 'Error deleting message');
    res.status(500).json({ error: 'Erro ao deletar mensagem' });
  }
}

