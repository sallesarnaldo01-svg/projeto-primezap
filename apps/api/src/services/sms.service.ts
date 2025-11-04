/**
 * Serviço de SMS usando Twilio
 * Suporta envio de SMS, verificação de status e consulta de mensagens
 */

import twilio from 'twilio';
import { logger } from '../lib/logger';

// Credenciais do Twilio (devem ser configuradas no .env)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

if (!accountSid || !authToken || !twilioNumber) {
  logger.warn('Twilio credentials not fully configured in environment variables. SMS service will not be initialized.');
}

// Cria uma instância do cliente Twilio
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Envia uma mensagem SMS usando o Twilio.
 * @param to Número de telefone do destinatário (ex: +5511999999999)
 * @param body Conteúdo da mensagem SMS (máximo 1600 caracteres)
 * @param from Número de origem (opcional, usa TWILIO_PHONE_NUMBER se não especificado)
 * @returns O status da mensagem enviada
 */
export async function sendSms(to: string, body: string, from?: string) {
  if (!client || !twilioNumber) {
    logger.error('Twilio client not initialized. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER.');
    throw new Error('Twilio client not initialized. Check environment variables.');
  }

  try {
    logger.info({ to, bodyLength: body.length, from: from || twilioNumber }, 'Sending SMS');

    const message = await client.messages.create({
      body,
      from: from || twilioNumber,
      to,
    });

    logger.info({ sid: message.sid, status: message.status, to }, 'SMS sent successfully');

    return {
      success: true,
      sid: message.sid,
      status: message.status,
      to: message.to,
      from: message.from,
      dateCreated: message.dateCreated,
    };
  } catch (error) {
    logger.error({ error, to }, 'Failed to send SMS');
    throw error;
  }
}

/**
 * Envia um SMS em lote para múltiplos destinatários.
 * @param recipients Lista de números de telefone
 * @param body Conteúdo da mensagem SMS
 * @returns Lista de resultados de envio
 */
export async function sendBulkSms(recipients: string[], body: string) {
  if (!client || !twilioNumber) {
    logger.error('Twilio client not initialized.');
    throw new Error('Twilio client not initialized. Check environment variables.');
  }

  logger.info({ recipientCount: recipients.length, bodyLength: body.length }, 'Sending bulk SMS');

  const results = await Promise.allSettled(
    recipients.map(async (to) => {
      try {
        return await sendSms(to, body);
      } catch (error) {
        logger.error({ error, to }, 'Failed to send SMS to recipient');
        return { success: false, to, error: (error as Error).message };
      }
    })
  );

  const successful = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  logger.info({ total: recipients.length, successful, failed }, 'Bulk SMS completed');

  return {
    total: recipients.length,
    successful,
    failed,
    results: results.map((r) => (r.status === 'fulfilled' ? r.value : { success: false, error: 'Unknown error' })),
  };
}

/**
 * Consulta o status de uma mensagem SMS pelo SID.
 * @param messageSid SID da mensagem Twilio
 * @returns Status da mensagem
 */
export async function getSmsStatus(messageSid: string) {
  if (!client) {
    logger.error('Twilio client not initialized.');
    throw new Error('Twilio client not initialized. Check environment variables.');
  }

  try {
    logger.info({ messageSid }, 'Fetching SMS status');

    const message = await client.messages(messageSid).fetch();

    logger.info({ messageSid, status: message.status }, 'SMS status retrieved');

    return {
      sid: message.sid,
      status: message.status,
      to: message.to,
      from: message.from,
      body: message.body,
      dateCreated: message.dateCreated,
      dateSent: message.dateSent,
      errorCode: message.errorCode,
      errorMessage: message.errorMessage,
    };
  } catch (error) {
    logger.error({ error, messageSid }, 'Failed to fetch SMS status');
    throw error;
  }
}

/**
 * Envia um SMS de verificação com código.
 * @param to Número de telefone do destinatário
 * @param code Código de verificação
 * @returns Resultado do envio
 */
export async function sendVerificationSms(to: string, code: string) {
  const body = `Seu código de verificação PrimeZap é: ${code}. Este código expira em 10 minutos.`;
  return sendSms(to, body);
}

/**
 * Envia um SMS de notificação de lead.
 * @param to Número de telefone do destinatário
 * @param leadName Nome do lead
 * @returns Resultado do envio
 */
export async function sendLeadNotificationSms(to: string, leadName: string) {
  const body = `Novo lead recebido: ${leadName}. Acesse o sistema PrimeZap para mais detalhes.`;
  return sendSms(to, body);
}

/**
 * Verifica se o serviço de SMS está configurado.
 * @returns true se configurado, false caso contrário
 */
export function isSmsConfigured(): boolean {
  return !!(accountSid && authToken && twilioNumber);
}
