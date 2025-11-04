/**
 * Serviço de Telegram usando node-telegram-bot-api
 * Suporta envio de mensagens, fotos, documentos e configuração de webhook
 */

import TelegramBot from 'node-telegram-bot-api';
import { logger } from '../lib/logger';

// Token do bot do Telegram (deve ser configurado no .env)
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  logger.warn('TELEGRAM_BOT_TOKEN not found in environment variables. Telegram service will not be initialized.');
}

// Cria uma instância do bot (polling: false para usar webhook)
const bot = token ? new TelegramBot(token, { polling: false }) : null;

/**
 * Envia uma mensagem de texto para um chat específico do Telegram.
 * @param chatId ID do chat de destino
 * @param message Mensagem de texto a ser enviada
 * @param options Opções adicionais (parse_mode, reply_markup, etc.)
 * @returns A mensagem enviada
 */
export async function sendTelegramMessage(
  chatId: string | number,
  message: string,
  options?: TelegramBot.SendMessageOptions
) {
  if (!bot) {
    logger.error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }

  try {
    logger.info({ chatId, messageLength: message.length }, 'Sending Telegram message');

    const sentMessage = await bot.sendMessage(chatId, message, options);

    logger.info({ chatId, messageId: sentMessage.message_id }, 'Telegram message sent successfully');

    return {
      success: true,
      messageId: sentMessage.message_id,
      chatId: sentMessage.chat.id,
      date: sentMessage.date,
    };
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to send Telegram message');
    throw error;
  }
}

/**
 * Envia uma foto para um chat específico do Telegram.
 * @param chatId ID do chat de destino
 * @param photo Caminho do arquivo ou URL da foto
 * @param caption Legenda da foto (opcional)
 * @returns A mensagem enviada
 */
export async function sendTelegramPhoto(
  chatId: string | number,
  photo: string | Buffer,
  caption?: string
) {
  if (!bot) {
    logger.error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }

  try {
    logger.info({ chatId, caption }, 'Sending Telegram photo');

    const sentMessage = await bot.sendPhoto(chatId, photo, { caption });

    logger.info({ chatId, messageId: sentMessage.message_id }, 'Telegram photo sent successfully');

    return {
      success: true,
      messageId: sentMessage.message_id,
      chatId: sentMessage.chat.id,
    };
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to send Telegram photo');
    throw error;
  }
}

/**
 * Envia um documento para um chat específico do Telegram.
 * @param chatId ID do chat de destino
 * @param document Caminho do arquivo ou Buffer
 * @param caption Legenda do documento (opcional)
 * @returns A mensagem enviada
 */
export async function sendTelegramDocument(
  chatId: string | number,
  document: string | Buffer,
  caption?: string
) {
  if (!bot) {
    logger.error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }

  try {
    logger.info({ chatId, caption }, 'Sending Telegram document');

    const sentMessage = await bot.sendDocument(chatId, document, {}, { caption });

    logger.info({ chatId, messageId: sentMessage.message_id }, 'Telegram document sent successfully');

    return {
      success: true,
      messageId: sentMessage.message_id,
      chatId: sentMessage.chat.id,
    };
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to send Telegram document');
    throw error;
  }
}

/**
 * Configura o webhook para receber atualizações do Telegram.
 * @param url URL para onde o Telegram deve enviar as atualizações
 * @returns Sucesso da operação
 */
export async function setTelegramWebhook(url: string) {
  if (!bot) {
    logger.error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }

  try {
    logger.info({ url }, 'Setting Telegram webhook');

    const success = await bot.setWebHook(url);

    logger.info({ url, success }, 'Telegram webhook set successfully');

    return { success };
  } catch (error) {
    logger.error({ error, url }, 'Failed to set Telegram webhook');
    throw error;
  }
}

/**
 * Remove o webhook do Telegram.
 * @returns Sucesso da operação
 */
export async function deleteTelegramWebhook() {
  if (!bot) {
    logger.error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }

  try {
    logger.info('Deleting Telegram webhook');

    const success = await bot.deleteWebHook();

    logger.info({ success }, 'Telegram webhook deleted successfully');

    return { success };
  } catch (error) {
    logger.error({ error }, 'Failed to delete Telegram webhook');
    throw error;
  }
}

/**
 * Obtém informações sobre o webhook configurado.
 * @returns Informações do webhook
 */
export async function getTelegramWebhookInfo() {
  if (!bot) {
    logger.error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }

  try {
    const info = await bot.getWebHookInfo();

    logger.info({ info }, 'Retrieved Telegram webhook info');

    return info;
  } catch (error) {
    logger.error({ error }, 'Failed to get Telegram webhook info');
    throw error;
  }
}

/**
 * Verifica se o serviço do Telegram está configurado.
 * @returns true se configurado, false caso contrário
 */
export function isTelegramConfigured(): boolean {
  return !!token;
}

export default bot;
