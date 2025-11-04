import TelegramBot from 'node-telegram-bot-api';

// Token do bot do Telegram (deve ser configurado no .env)
const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.warn('TELEGRAM_BOT_TOKEN not found in environment variables. Telegram service will not be initialized.');
}

// Cria uma instância do bot
const bot = token ? new TelegramBot(token, { polling: false }) : null;

/**
 * Envia uma mensagem de texto para um chat específico do Telegram.
 * @param chatId ID do chat de destino
 * @param message Mensagem de texto a ser enviada
 * @returns A mensagem enviada
 */
export async function sendTelegramMessage(chatId: string | number, message: string) {
  if (!bot) {
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }
  try {
    const sentMessage = await bot.sendMessage(chatId, message);
    return sentMessage;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw new Error('Failed to send Telegram message');
  }
}

/**
 * Configura o webhook para receber atualizações do Telegram.
 * @param url URL para onde o Telegram deve enviar as atualizações
 */
export async function setTelegramWebhook(url: string) {
  if (!bot) {
    throw new Error('Telegram bot not initialized. Check TELEGRAM_BOT_TOKEN.');
  }
  try {
    const success = await bot.setWebHook(url);
    return success;
  } catch (error) {
    console.error('Error setting Telegram webhook:', error);
    throw new Error('Failed to set Telegram webhook');
  }
}

export default bot;
