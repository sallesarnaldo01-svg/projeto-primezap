// apps/worker/src/processors/campaign.processor.ts
import { Job } from 'bullmq';
import { supabase } from '../lib/supabase';
import axios from 'axios';

/**
 * Processor para campanhas de disparo programado
 * Implementa simulação de digitação e gravação em tempo real
 */

interface CampaignJob {
  campaignId: string;
}

export async function processCampaign(job: Job<CampaignJob>) {
  const { campaignId } = job.data;

  try {
    // Buscar campanha
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select(`
        *,
        integration:integrations(*),
        messages:campaign_messages(*),
        recipients:campaign_recipients(
          *,
          contact:contacts(*)
        )
      `)
      .eq('id', campaignId)
      .single();

    if (campaignError) throw campaignError;

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    // Verificar se a campanha está ativa
    if (campaign.status !== 'running') {
      console.log(`Campaign ${campaignId} is not running. Skipping.`);
      return;
    }

    // Processar cada destinatário
    const pendingRecipients = campaign.recipients.filter(
      (r: any) => r.status === 'pending'
    );

    for (const recipient of pendingRecipients) {
      try {
        // Verificar se a campanha ainda está rodando
        const { data: currentCampaign } = await supabase
          .from('campaigns')
          .select('status')
          .eq('id', campaignId)
          .single();

        if (currentCampaign?.status !== 'running') {
          console.log(`Campaign ${campaignId} was paused/cancelled. Stopping.`);
          break;
        }

        // Atualizar status do destinatário
        await supabase
          .from('campaign_recipients')
          .update({ status: 'processing' })
          .eq('id', recipient.id);

        // Processar sequência de mensagens
        await processMessageSequence(
          campaign,
          recipient.contact,
          campaign.messages
        );

        // Atualizar status do destinatário
        await supabase
          .from('campaign_recipients')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', recipient.id);

        // Atualizar contador da campanha
        await supabase
          .from('campaigns')
          .update({ sent_count: campaign.sent_count + 1 })
          .eq('id', campaignId);

        // Delay entre contatos
        await sleep(campaign.delay_between_messages * 1000);

      } catch (error: any) {
        console.error(`Error processing recipient ${recipient.id}:`, error);

        // Atualizar status para falha
        await supabase
          .from('campaign_recipients')
          .update({ 
            status: 'failed',
            failed_at: new Date().toISOString(),
            error_message: error.message
          })
          .eq('id', recipient.id);

        // Atualizar contador de falhas
        await supabase
          .from('campaigns')
          .update({ failed_count: campaign.failed_count + 1 })
          .eq('id', campaignId);
      }
    }

    // Verificar se todos os destinatários foram processados
    const { data: allRecipients } = await supabase
      .from('campaign_recipients')
      .select('status')
      .eq('campaign_id', campaignId);

    const allProcessed = allRecipients?.every(
      (r: any) => r.status !== 'pending' && r.status !== 'processing'
    );

    if (allProcessed) {
      await supabase
        .from('campaigns')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId);
    }

    return { success: true, campaignId };

  } catch (error: any) {
    console.error(`Error processing campaign ${campaignId}:`, error);
    
    // Atualizar status da campanha para erro
    await supabase
      .from('campaigns')
      .update({ status: 'error' })
      .eq('id', campaignId);

    throw error;
  }
}

/**
 * Processar sequência de mensagens com simulação de digitação/gravação
 */
async function processMessageSequence(
  campaign: any,
  contact: any,
  messages: any[]
) {
  const integration = campaign.integration;

  // Ordenar mensagens por sequência
  const sortedMessages = messages.sort((a, b) => a.sequence_order - b.sequence_order);

  for (const message of sortedMessages) {
    try {
      // Simular "digitando..." ou "gravando áudio..."
      if (campaign.simulate_typing || campaign.simulate_recording) {
        await simulateActivity(integration, contact, message, campaign);
      }

      // Enviar mensagem
      await sendMessageToContact(integration, contact, message);

      // Delay após enviar mensagem
      if (message.delay_after > 0) {
        await sleep(message.delay_after * 1000);
      }

    } catch (error: any) {
      console.error(`Error sending message ${message.id}:`, error);
      throw error;
    }
  }
}

/**
 * Simular atividade (digitando ou gravando)
 */
async function simulateActivity(
  integration: any,
  contact: any,
  message: any,
  campaign: any
) {
  const platform = integration.platform;

  // Determinar tipo de atividade
  let action: string;
  let duration: number;

  if (message.type === 'audio' && campaign.simulate_recording) {
    action = 'recording';
    duration = message.recording_duration || 3;
  } else if (campaign.simulate_typing) {
    action = 'typing';
    duration = message.typing_duration || calculateTypingDuration(message.content);
  } else {
    return; // Não simular
  }

  // Enviar indicador de atividade
  if (platform === 'whatsapp') {
    await sendWhatsAppActivity(integration, contact, action);
  }

  // Aguardar duração da atividade
  await sleep(duration * 1000);
}

/**
 * Enviar indicador de atividade no WhatsApp
 */
async function sendWhatsAppActivity(
  integration: any,
  contact: any,
  action: string
) {
  try {
    // WhatsApp não tem API oficial para "digitando...", mas podemos simular com delay
    // Em uma implementação real, isso seria feito via webhook ou socket
    console.log(`[WhatsApp] Simulating ${action} for ${contact.phone}`);
  } catch (error) {
    console.error('Error sending activity indicator:', error);
  }
}

/**
 * Enviar mensagem para o contato
 */
async function sendMessageToContact(
  integration: any,
  contact: any,
  message: any
) {
  const platform = integration.platform;

  switch (platform) {
    case 'whatsapp':
      return await sendWhatsAppMessage(integration, contact, message);
    case 'facebook':
      return await sendFacebookMessage(integration, contact, message);
    case 'instagram':
      return await sendInstagramMessage(integration, contact, message);
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Enviar mensagem via WhatsApp
 */
async function sendWhatsAppMessage(
  integration: any,
  contact: any,
  message: any
) {
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
  } else if (message.type === 'document') {
    payload.type = 'document';
    payload.document = { link: message.media_url };
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

  return response.data;
}

/**
 * Enviar mensagem via Facebook Messenger
 */
async function sendFacebookMessage(
  integration: any,
  contact: any,
  message: any
) {
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

  return response.data;
}

/**
 * Enviar mensagem via Instagram Direct
 */
async function sendInstagramMessage(
  integration: any,
  contact: any,
  message: any
) {
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

  return response.data;
}

/**
 * Calcular duração de digitação baseado no tamanho do texto
 */
function calculateTypingDuration(content: string): number {
  if (!content) return 0;
  
  const words = content.split(' ').length;
  const wordsPerMinute = 40; // Velocidade média de digitação
  const seconds = Math.ceil((words / wordsPerMinute) * 60);
  
  // Mínimo 1 segundo, máximo 10 segundos
  return Math.max(1, Math.min(10, seconds));
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
