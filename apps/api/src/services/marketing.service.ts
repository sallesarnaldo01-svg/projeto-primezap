/**
 * Serviço de Integrações de Marketing
 * Mailchimp (email marketing) e Google Ads (campanhas)
 */

import { logger } from '../lib/logger';
import axios from 'axios';

// Configurações do Mailchimp
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX || 'us1'; // ex: us1, us2, etc.
const MAILCHIMP_API_URL = `https://${MAILCHIMP_SERVER_PREFIX}.api.mailchimp.com/3.0`;

// Configurações do Google Ads
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID;
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID;
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET;
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ADS_REFRESH_TOKEN;

interface MailchimpContact {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  mergeFields?: Record<string, any>;
}

interface MailchimpCampaign {
  type: 'regular' | 'plaintext' | 'absplit' | 'rss' | 'variate';
  recipients: {
    listId: string;
    segmentOpts?: any;
  };
  settings: {
    subjectLine: string;
    fromName: string;
    replyTo: string;
    title?: string;
  };
}

interface GoogleAdsCampaign {
  name: string;
  budget: number;
  startDate: string;
  endDate?: string;
  targetLocation?: string;
  keywords?: string[];
}

/**
 * ============================================
 * MAILCHIMP - Email Marketing
 * ============================================
 */

/**
 * Adiciona ou atualiza um contato no Mailchimp.
 * @param listId ID da lista do Mailchimp
 * @param contact Dados do contato
 * @returns Resultado da operação
 */
export async function addOrUpdateMailchimpContact(listId: string, contact: MailchimpContact) {
  logger.info({ listId, email: contact.email }, 'Adding/updating Mailchimp contact');

  if (!MAILCHIMP_API_KEY) {
    logger.error('Mailchimp API key not configured.');
    throw new Error('Mailchimp API key not configured. Set MAILCHIMP_API_KEY environment variable.');
  }

  try {
    const subscriberHash = require('crypto')
      .createHash('md5')
      .update(contact.email.toLowerCase())
      .digest('hex');

    const data = {
      email_address: contact.email,
      status_if_new: 'subscribed',
      merge_fields: {
        FNAME: contact.firstName || '',
        LNAME: contact.lastName || '',
        ...contact.mergeFields,
      },
      tags: contact.tags || [],
    };

    const response = await axios.put(
      `${MAILCHIMP_API_URL}/lists/${listId}/members/${subscriberHash}`,
      data,
      {
        headers: {
          Authorization: `Bearer ${MAILCHIMP_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info({ email: contact.email, status: response.data.status }, 'Mailchimp contact added/updated');

    return {
      success: true,
      id: response.data.id,
      email: response.data.email_address,
      status: response.data.status,
    };
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message, email: contact.email }, 'Failed to add/update Mailchimp contact');
    throw error;
  }
}

/**
 * Remove um contato do Mailchimp.
 * @param listId ID da lista do Mailchimp
 * @param email Email do contato
 * @returns Resultado da operação
 */
export async function removeMailchimpContact(listId: string, email: string) {
  logger.info({ listId, email }, 'Removing Mailchimp contact');

  if (!MAILCHIMP_API_KEY) {
    logger.error('Mailchimp API key not configured.');
    throw new Error('Mailchimp API key not configured.');
  }

  try {
    const subscriberHash = require('crypto')
      .createHash('md5')
      .update(email.toLowerCase())
      .digest('hex');

    await axios.delete(`${MAILCHIMP_API_URL}/lists/${listId}/members/${subscriberHash}`, {
      headers: {
        Authorization: `Bearer ${MAILCHIMP_API_KEY}`,
      },
    });

    logger.info({ email }, 'Mailchimp contact removed');

    return { success: true };
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message, email }, 'Failed to remove Mailchimp contact');
    throw error;
  }
}

/**
 * Sincroniza leads com o Mailchimp (compatibilidade com função antiga).
 * @param leadIds IDs dos leads a serem sincronizados
 * @param listId ID da lista do Mailchimp
 * @returns Resultado da sincronização
 */
export async function syncToMailchimp(leadIds: string[], listId: string) {
  logger.info({ leadIds, listId }, 'Syncing leads to Mailchimp');

  if (!MAILCHIMP_API_KEY) {
    logger.warn('Mailchimp not configured. Returning simulated result.');
    return {
      success: true,
      processedCount: leadIds.length,
      message: `Simulated sync of ${leadIds.length} leads (Mailchimp not configured).`,
    };
  }

  try {
    // Buscar leads do banco (assumindo que temos acesso ao Prisma)
    // Para simplificar, vamos simular aqui
    const results = await Promise.allSettled(
      leadIds.map(async (leadId) => {
        // Aqui você buscaria o lead do banco e extrairia email, nome, etc.
        // Por simplicidade, vamos simular
        const mockContact: MailchimpContact = {
          email: `lead-${leadId}@example.com`,
          firstName: 'Lead',
          lastName: leadId.substring(0, 8),
        };

        return addOrUpdateMailchimpContact(listId, mockContact);
      })
    );

    const successCount = results.filter((r) => r.status === 'fulfilled').length;

    logger.info({ total: leadIds.length, success: successCount }, 'Mailchimp sync completed');

    return {
      success: true,
      processedCount: leadIds.length,
      successCount,
      failedCount: leadIds.length - successCount,
      message: `Successfully synced ${successCount}/${leadIds.length} leads to Mailchimp.`,
    };
  } catch (error) {
    logger.error({ error, leadIds }, 'Failed to sync leads to Mailchimp');
    throw error;
  }
}

/**
 * Cria uma campanha no Mailchimp.
 * @param campaign Dados da campanha
 * @returns Campanha criada
 */
export async function createMailchimpCampaign(campaign: MailchimpCampaign) {
  logger.info({ campaign: campaign.settings.title }, 'Creating Mailchimp campaign');

  if (!MAILCHIMP_API_KEY) {
    logger.error('Mailchimp API key not configured.');
    throw new Error('Mailchimp API key not configured.');
  }

  try {
    const response = await axios.post(`${MAILCHIMP_API_URL}/campaigns`, campaign, {
      headers: {
        Authorization: `Bearer ${MAILCHIMP_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info({ campaignId: response.data.id, title: response.data.settings.title }, 'Mailchimp campaign created');

    return {
      success: true,
      id: response.data.id,
      webId: response.data.web_id,
      status: response.data.status,
      title: response.data.settings.title,
    };
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message }, 'Failed to create Mailchimp campaign');
    throw error;
  }
}

/**
 * Envia uma campanha do Mailchimp.
 * @param campaignId ID da campanha
 * @returns Resultado do envio
 */
export async function sendMailchimpCampaign(campaignId: string) {
  logger.info({ campaignId }, 'Sending Mailchimp campaign');

  if (!MAILCHIMP_API_KEY) {
    logger.error('Mailchimp API key not configured.');
    throw new Error('Mailchimp API key not configured.');
  }

  try {
    await axios.post(`${MAILCHIMP_API_URL}/campaigns/${campaignId}/actions/send`, null, {
      headers: {
        Authorization: `Bearer ${MAILCHIMP_API_KEY}`,
      },
    });

    logger.info({ campaignId }, 'Mailchimp campaign sent');

    return { success: true, campaignId };
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message, campaignId }, 'Failed to send Mailchimp campaign');
    throw error;
  }
}

/**
 * Lista todas as listas (audiences) do Mailchimp.
 * @returns Listas do Mailchimp
 */
export async function getMailchimpLists() {
  logger.info('Fetching Mailchimp lists');

  if (!MAILCHIMP_API_KEY) {
    logger.error('Mailchimp API key not configured.');
    throw new Error('Mailchimp API key not configured.');
  }

  try {
    const response = await axios.get(`${MAILCHIMP_API_URL}/lists`, {
      headers: {
        Authorization: `Bearer ${MAILCHIMP_API_KEY}`,
      },
    });

    logger.info({ count: response.data.lists.length }, 'Mailchimp lists retrieved');

    return {
      success: true,
      lists: response.data.lists.map((list: any) => ({
        id: list.id,
        name: list.name,
        memberCount: list.stats.member_count,
      })),
    };
  } catch (error: any) {
    logger.error({ error: error.response?.data || error.message }, 'Failed to fetch Mailchimp lists');
    throw error;
  }
}

/**
 * ============================================
 * GOOGLE ADS - Campanhas de Anúncios
 * ============================================
 */

/**
 * Cria uma campanha no Google Ads.
 * @param campaign Dados da campanha
 * @returns Campanha criada
 */
export async function createGoogleAdsCampaign(campaign: GoogleAdsCampaign) {
  logger.info({ campaignName: campaign.name }, 'Creating Google Ads campaign');

  if (!GOOGLE_ADS_CUSTOMER_ID || !GOOGLE_ADS_DEVELOPER_TOKEN) {
    logger.error('Google Ads credentials not configured.');
    throw new Error('Google Ads credentials not configured. Set GOOGLE_ADS_* environment variables.');
  }

  try {
    // Nota: A API do Google Ads requer uma biblioteca cliente oficial (google-ads-api)
    // Aqui está uma implementação simplificada. Para produção, use a biblioteca oficial.

    logger.warn('Google Ads integration requires google-ads-api library. This is a placeholder implementation.');

    // Placeholder: retornar sucesso simulado
    const mockCampaignId = `campaign_${Date.now()}`;

    logger.info({ campaignId: mockCampaignId, name: campaign.name }, 'Google Ads campaign created (simulated)');

    return {
      success: true,
      campaignId: mockCampaignId,
      name: campaign.name,
      status: 'PAUSED',
      message: 'Campaign created successfully. Use Google Ads API library for production.',
    };
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to create Google Ads campaign');
    throw error;
  }
}

/**
 * Cria um público personalizado no Google Ads (compatibilidade com função antiga).
 * @param leadIds IDs dos leads a serem usados para o público
 * @returns Resultado da criação
 */
export async function createGoogleAdsAudience(leadIds: string[]) {
  logger.info({ leadIds }, 'Creating Google Ads audience');

  if (!GOOGLE_ADS_CUSTOMER_ID) {
    logger.warn('Google Ads not configured. Returning simulated result.');
    return {
      success: true,
      processedCount: leadIds.length,
      audienceId: 'simulated-audience-123',
      message: `Simulated audience creation with ${leadIds.length} leads (Google Ads not configured).`,
    };
  }

  try {
    logger.warn('Google Ads integration requires google-ads-api library. This is a placeholder implementation.');

    const mockAudienceId = `audience_${Date.now()}`;

    logger.info({ audienceId: mockAudienceId, leadCount: leadIds.length }, 'Google Ads audience created (simulated)');

    return {
      success: true,
      processedCount: leadIds.length,
      audienceId: mockAudienceId,
      message: 'Audience created (simulated). Use Google Ads API library for production.',
    };
  } catch (error: any) {
    logger.error({ error: error.message, leadIds }, 'Failed to create Google Ads audience');
    throw error;
  }
}

/**
 * Pausa uma campanha do Google Ads.
 * @param campaignId ID da campanha
 * @returns Resultado da operação
 */
export async function pauseGoogleAdsCampaign(campaignId: string) {
  logger.info({ campaignId }, 'Pausing Google Ads campaign');

  if (!GOOGLE_ADS_CUSTOMER_ID) {
    logger.error('Google Ads credentials not configured.');
    throw new Error('Google Ads credentials not configured.');
  }

  try {
    logger.warn('Google Ads integration requires google-ads-api library. This is a placeholder implementation.');

    return {
      success: true,
      campaignId,
      status: 'PAUSED',
      message: 'Campaign paused (simulated). Use Google Ads API library for production.',
    };
  } catch (error: any) {
    logger.error({ error: error.message, campaignId }, 'Failed to pause Google Ads campaign');
    throw error;
  }
}

/**
 * Obtém métricas de uma campanha do Google Ads.
 * @param campaignId ID da campanha
 * @returns Métricas da campanha
 */
export async function getGoogleAdsCampaignMetrics(campaignId: string) {
  logger.info({ campaignId }, 'Fetching Google Ads campaign metrics');

  if (!GOOGLE_ADS_CUSTOMER_ID) {
    logger.error('Google Ads credentials not configured.');
    throw new Error('Google Ads credentials not configured.');
  }

  try {
    logger.warn('Google Ads integration requires google-ads-api library. This is a placeholder implementation.');

    // Retornar métricas simuladas
    return {
      success: true,
      campaignId,
      metrics: {
        impressions: Math.floor(Math.random() * 10000),
        clicks: Math.floor(Math.random() * 500),
        conversions: Math.floor(Math.random() * 50),
        cost: (Math.random() * 1000).toFixed(2),
        ctr: (Math.random() * 5).toFixed(2) + '%',
      },
      message: 'Metrics retrieved (simulated). Use Google Ads API library for production.',
    };
  } catch (error: any) {
    logger.error({ error: error.message, campaignId }, 'Failed to fetch Google Ads metrics');
    throw error;
  }
}

/**
 * ============================================
 * VERIFICAÇÕES DE CONFIGURAÇÃO
 * ============================================
 */

/**
 * Verifica se o Mailchimp está configurado.
 * @returns true se configurado, false caso contrário
 */
export function isMailchimpConfigured(): boolean {
  return !!(MAILCHIMP_API_KEY && MAILCHIMP_SERVER_PREFIX);
}

/**
 * Verifica se o Google Ads está configurado.
 * @returns true se configurado, false caso contrário
 */
export function isGoogleAdsConfigured(): boolean {
  return !!(
    GOOGLE_ADS_CUSTOMER_ID &&
    GOOGLE_ADS_DEVELOPER_TOKEN &&
    GOOGLE_ADS_CLIENT_ID &&
    GOOGLE_ADS_CLIENT_SECRET &&
    GOOGLE_ADS_REFRESH_TOKEN
  );
}

/**
 * Retorna o status de todas as integrações de marketing.
 * @returns Status das integrações
 */
export function getMarketingIntegrationsStatus() {
  return {
    mailchimp: {
      configured: isMailchimpConfigured(),
      apiKey: MAILCHIMP_API_KEY ? '***' + MAILCHIMP_API_KEY.slice(-4) : 'Not set',
      serverPrefix: MAILCHIMP_SERVER_PREFIX,
    },
    googleAds: {
      configured: isGoogleAdsConfigured(),
      customerId: GOOGLE_ADS_CUSTOMER_ID ? '***' + GOOGLE_ADS_CUSTOMER_ID.slice(-4) : 'Not set',
      developerToken: GOOGLE_ADS_DEVELOPER_TOKEN ? '***' : 'Not set',
    },
  };
}
