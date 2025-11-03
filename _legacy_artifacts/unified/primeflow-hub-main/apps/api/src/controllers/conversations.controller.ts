// apps/api/src/controllers/conversations.controller.ts
import { Request, Response } from 'express';
import axios from 'axios';
import { supabase } from '../lib/supabase';

/**
 * Controller para gerenciar conversas
 */

// Listar todas as conversas
export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('conversations')
      .select(`
        id,
        status,
        last_message_content,
        last_message_at,
        last_message_from,
        unread_count,
        message_count,
        created_at,
        updated_at,
        contact:contacts(
          id,
          name,
          phone,
          avatar_url
        ),
        integration:integrations(
          id,
          platform,
          name
        )
      `)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: error.message });
  }
};

// Obter uma conversa específica
export const getConversation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const { data, error } = await supabase
      .from('conversations')
      .select(`
        *,
        contact:contacts(*),
        integration:integrations(*),
        messages:messages(
          id,
          content,
          type,
          sender,
          status,
          media_url,
          created_at,
          delivered_at,
          read_at
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Marcar mensagens como lidas
    await supabase
      .from('messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .eq('sender', 'contact')
      .neq('status', 'read');

    // Resetar contador de não lidas
    await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', id);

    res.json(data);
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: error.message });
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
    const userId = req.user?.id;
    const { content, type = 'text', media_url } = req.body;

    // Verificar se a conversa existe
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*, integration:integrations(*), contact:contacts(*)')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError) throw convError;

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Criar mensagem no banco
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        type,
        sender: 'user',
        sender_id: userId,
        status: 'pending',
        media_url,
      })
      .select()
      .single();

    if (msgError) throw msgError;

    // Enviar mensagem via integração
    try {
      await sendMessageViaIntegration(conversation, message);

      // Atualizar status para enviado
      await supabase
        .from('messages')
        .update({ status: 'sent' })
        .eq('id', message.id);

      message.status = 'sent';
    } catch (sendError: any) {
      console.error('Error sending message via integration:', sendError);

      // Atualizar status para falha
      await supabase
        .from('messages')
        .update({ status: 'failed' })
        .eq('id', message.id);

      message.status = 'failed';
    }

    res.status(201).json(message);
  } catch (error: any) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
};

// Marcar como lida
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    // Marcar mensagens como lidas
    await supabase
      .from('messages')
      .update({ status: 'read', read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .eq('sender', 'contact')
      .neq('status', 'read');

    // Resetar contador
    const { data, error } = await supabase
      .from('conversations')
      .update({ unread_count: 0 })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error: any) {
    console.error('Error marking as read:', error);
    res.status(500).json({ error: error.message });
  }
};

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Enviar mensagem via integração (WhatsApp, Facebook, Instagram)
 */
async function sendMessageViaIntegration(conversation: any, message: any) {
  const integration = conversation.integration;
  const contact = conversation.contact;

  switch (integration.platform) {
    case 'whatsapp':
      return await sendWhatsAppMessage(integration, contact, message);
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
async function sendWhatsAppMessage(integration: any, contact: any, message: any) {
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
    .update({ external_id: response.data.messages[0].id })
    .eq('id', message.id);

  return response.data;
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
