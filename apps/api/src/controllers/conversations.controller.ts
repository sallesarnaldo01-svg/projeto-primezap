// apps/api/src/controllers/conversations.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { randomUUID } from 'node:crypto';

/**
 * Controller para gerenciar conversas
 */

// Listar todas as conversas
export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id as string;
    const { status, limit = 50, offset = 0 } = req.query as any;

    const where: any = { userId };
    if (typeof status === 'string' && status.trim()) where.status = status.trim();

    const records = await prisma.conversation.findMany({
      where,
      include: {
        contact: { select: { id: true, name: true, phone: true, avatarUrl: true } },
        integration: { select: { id: true, platform: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: Number(offset ?? 0),
      take: Number(limit ?? 50),
    });

    const data = records.map((c) => ({
      id: c.id,
      status: c.status ?? 'active',
      last_message_content: c.lastMessageContent ?? null,
      last_message_at: c.lastMessageAt?.toISOString() ?? null,
      last_message_from: c.lastMessageFrom ?? null,
      unread_count: c.unreadCount ?? 0,
      message_count: c.messageCount ?? 0,
      created_at: c.createdAt?.toISOString() ?? null,
      updated_at: c.updatedAt?.toISOString() ?? null,
      contact: c.contact
        ? {
            id: c.contact.id,
            name: c.contact.name,
            phone: c.contact.phone ?? '',
            avatar_url: c.contact.avatarUrl ?? null,
          }
        : null,
      integration: c.integration
        ? { id: c.integration.id, platform: c.integration.platform, name: (c.integration as any).name }
        : null,
    }));

    return res.json(data);
  } catch (error: any) {
    console.error('Error fetching conversations (prisma):', error);
    return res.status(200).json([]);
  }
};

// Obter uma conversa específica
export const getConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id as string;

    const convo = await prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        contact: true,
        integration: true,
      },
    });

    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        content: true,
        type: true,
        sender: true,
        status: true,
        mediaUrl: true,
        createdAt: true,
        deliveredAt: true,
        readAt: true,
      },
    });

    // Marcar como lidas mensagens do contato
    await prisma.message.updateMany({
      where: { conversationId: id, sender: 'contact', NOT: { status: 'read' } },
      data: { status: 'read', readAt: new Date() },
    });

    // Resetar contador de não lidas
    await prisma.conversation.update({ where: { id }, data: { unreadCount: 0 } }).catch(() => undefined);

    const payload = {
      ...convo,
      contact: convo.contact
        ? {
            id: convo.contact.id,
            name: convo.contact.name,
            phone: convo.contact.phone ?? '',
            avatar_url: convo.contact.avatarUrl ?? null,
          }
        : null,
      messages: messages.map((m) => ({
        id: m.id,
        content: m.content,
        type: m.type,
        sender: m.sender,
        status: m.status,
        media_url: m.mediaUrl,
        created_at: m.createdAt?.toISOString() ?? null,
        delivered_at: m.deliveredAt?.toISOString() ?? null,
        read_at: m.readAt?.toISOString() ?? null,
      })),
    };

    return res.json(payload);
  } catch (error: any) {
    console.error('Error fetching conversation (prisma):', error);
    return res.status(500).json({ error: error.message });
  }
};

// Criar nova conversa
export const createConversation = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { contact_id, integration_id } = req.body;

    // Verificar se já existe conversa com este contato
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('contact_id', contact_id)
      .eq('integration_id', integration_id)
      .single();

    if (existing) {
      return res.status(409).json({ 
        error: 'Conversation already exists',
        conversation_id: existing.id 
      });
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        contact_id,
        integration_id,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error: any) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

// Atualizar conversa
export const updateConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const updates = req.body;

    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

// Arquivar conversa
export const archiveConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('conversations')
      .update({ status: 'archived' })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json(data);
  } catch (error: any) {
    console.error('Error archiving conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

// Deletar conversa
export const deleteConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: error.message });
  }
};

// Enviar mensagem
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user?.id as string;
    const tenantId = req.user?.tenantId as string;
    const { content, type = 'text', media_url } = req.body as { content?: string; type?: string; media_url?: string };

    const convo = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      include: { contact: true },
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    // Cria mensagem pendente
    const message = await prisma.message.create({
      data: {
        conversationId,
        content: content ?? null,
        type,
        sender: 'user',
        senderId: userId,
        status: 'pending',
        mediaUrl: media_url ?? null,
      },
      select: {
        id: true,
        content: true,
        type: true,
        sender: true,
        status: true,
        mediaUrl: true,
        createdAt: true,
      },
    });

    // Publica no worker para envio via provider
    await redis.publish(
      'messages:send',
      JSON.stringify({
        messageId: message.id,
        contactId: convo.contactId,
        type: type === 'text' ? 'text' : type,
        content: content,
        mediaUrl: media_url,
        tenantId,
      }),
    );

    const payload = {
      id: message.id,
      content: message.content,
      type: message.type,
      sender: message.sender,
      status: message.status,
      media_url: message.mediaUrl,
      created_at: message.createdAt?.toISOString() ?? null,
    };

    return res.status(201).json(payload);
  } catch (error: any) {
    console.error('Error sending message (prisma):', error);
    return res.status(500).json({ error: error.message });
  }
};

// Marcar como lida
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id as string;

    await prisma.message.updateMany({
      where: { conversationId: id, sender: 'contact', NOT: { status: 'read' } },
      data: { status: 'read', readAt: new Date() },
    });

    const updated = await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });

    return res.json({ id: updated.id, unread_count: 0 });
  } catch (error: any) {
    console.error('Error marking as read (prisma):', error);
    return res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Enviar mensagem via integração (WhatsApp, Facebook, Instagram)
 */
async function sendMessageViaIntegration(conversation: any, message: any, tenantId?: string | null) {
  const integration = conversation.integration;
  const contact = conversation.contact;

  switch (integration.platform) {
    case 'whatsapp':
      return await sendWhatsAppMessage(integration, contact, message, tenantId);
    case 'facebook':
      return await sendFacebookMessage(integration, contact, message);
    case 'instagram':
      return await sendInstagramMessage(integration, contact, message);
    default:
      throw new Error('Unsupported platform');
  }
}

/**
 * Enviar mensagem via WhatsApp
 */
async function sendWhatsAppMessage(integration: any, contact: any, message: any, tenantId?: string | null) {
  // Se houver access_token/phone_number_id configurados, usar Graph (modo legado)
  if (integration?.access_token && integration?.phone_number_id) {
    const payload: any = {
      messaging_product: 'whatsapp',
      to: contact.phone,
    };

    if (message.type === 'text') {
      payload.type = 'text';
      payload.text = { body: message.content };
    } else if (message.type === 'image') {
      payload.type = 'image';
      payload.image = { link: message.media_url };
    } else if (message.type === 'video') {
      payload.type = 'video';
      payload.video = { link: message.media_url };
    } else if (message.type === 'audio') {
      payload.type = 'audio';
      payload.audio = { link: message.media_url };
    }

    const response = await axios.post(
      `https://graph.facebook.com/${integration.api_version}/${integration.phone_number_id}/messages`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Atualizar external_id
    await supabase
      .from('messages')
      .update({ external_id: response.data.messages?.[0]?.id ?? null, status: 'sent' })
      .eq('id', message.id);

    return response.data;
  }

  // Caso contrário, roteia via Worker/WhatsApp provider (Baileys/Venom) usando broadcast:mass com um único destino
  // Encontrar conexão WhatsApp CONECTADA para o tenant
  const connection = await prisma.connections.findFirst({
    where: {
      type: 'WHATSAPP',
      status: 'CONNECTED',
      ...(tenantId ? { tenantId } : {}),
    },
    orderBy: { updatedAt: 'desc' as any },
  });

  if (!connection) {
    throw new Error('WhatsApp provider not connected (no active connection)');
  }

  const broadcastId = randomUUID();
  const text = message.type === 'text' ? message.content : undefined;
  const mediaUrl = message.type !== 'text' ? message.media_url : undefined;
  const mediaType = ((): 'image' | 'audio' | 'video' | 'document' | undefined => {
    switch (message.type) {
      case 'image':
        return 'image';
      case 'audio':
        return 'audio';
      case 'video':
        return 'video';
      case 'document':
        return 'document';
      default:
        return undefined;
    }
  })();

  await redis.publish(
    'broadcast:mass',
    JSON.stringify({
      broadcastId,
      connectionId: connection.id,
      contacts: [String(contact.phone ?? '').trim()],
      message: {
        ...(text ? { text } : {}),
        ...(mediaUrl ? { mediaUrl, mediaType } : {}),
      },
      delayMs: 0,
      provider: (connection.config as any)?.provider ?? 'baileys',
    }),
  );

  // Atualiza status para 'queued' e mantém processamento assíncrono no Worker
  await supabase
    .from('messages')
    .update({ status: 'pending' })
    .eq('id', message.id);

  return { queued: true, broadcastId };
}

/**
 * Enviar mensagem via Facebook
 */
async function sendFacebookMessage(integration: any, contact: any, message: any) {
  if (!contact.facebook_id) {
    throw new Error('Contact does not have a Facebook ID configured');
  }

  const payload: any = {
    recipient: { id: contact.facebook_id },
    message: {},
  };

  if (message.type === 'text') {
    payload.message.text = message.content;
  } else if (message.type === 'image') {
    payload.message.attachment = {
      type: 'image',
      payload: { url: message.media_url },
    };
  } else if (message.type === 'video') {
    payload.message.attachment = {
      type: 'video',
      payload: { url: message.media_url },
    };
  } else if (message.type === 'audio') {
    payload.message.attachment = {
      type: 'audio',
      payload: { url: message.media_url },
    };
  } else if (message.type === 'document') {
    payload.message.attachment = {
      type: 'file',
      payload: { url: message.media_url },
    };
  }

  const response = await axios.post(
    `https://graph.facebook.com/${integration.api_version}/me/messages`,
    payload,
    {
      params: {
        access_token: integration.access_token,
      },
    }
  );

  if (response.data?.message_id) {
    await supabase
      .from('messages')
      .update({ external_id: response.data.message_id })
      .eq('id', message.id);
  }

  return response.data;
}

/**
 * Enviar mensagem via Instagram
 */
async function sendInstagramMessage(integration: any, contact: any, message: any) {
  if (!contact.instagram_id) {
    throw new Error('Contact does not have an Instagram ID configured');
  }

  const payload: any = {
    recipient: { id: contact.instagram_id },
    message: {},
  };

  if (message.type === 'text') {
    payload.message.text = message.content;
  } else if (message.type === 'image') {
    payload.message.attachment = {
      type: 'image',
      payload: { url: message.media_url },
    };
  } else if (message.type === 'video') {
    payload.message.attachment = {
      type: 'video',
      payload: { url: message.media_url },
    };
  }

  const response = await axios.post(
    `https://graph.facebook.com/${integration.api_version}/me/messages`,
    payload,
    {
      params: {
        access_token: integration.access_token,
      },
    }
  );

  if (response.data?.message_id) {
    await supabase
      .from('messages')
      .update({ external_id: response.data.message_id })
      .eq('id', message.id);
  }

  return response.data;
}
