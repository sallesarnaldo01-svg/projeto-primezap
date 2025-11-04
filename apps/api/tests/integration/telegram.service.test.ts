import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendTelegramMessage,
  sendTelegramPhoto,
  sendTelegramDocument,
  setWebhook,
  verifyTelegramConfig,
} from '../../src/services/telegram.service';
import TelegramBot from 'node-telegram-bot-api';

// Mock do node-telegram-bot-api
vi.mock('node-telegram-bot-api');

describe('Telegram Service', () => {
  let mockBot: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock do bot
    mockBot = {
      sendMessage: vi.fn().mockResolvedValue({
        message_id: 123,
        chat: { id: 456 },
        text: 'Test message',
        date: Date.now(),
      }),
      sendPhoto: vi.fn().mockResolvedValue({
        message_id: 124,
        chat: { id: 456 },
        photo: [{ file_id: 'photo123' }],
      }),
      sendDocument: vi.fn().mockResolvedValue({
        message_id: 125,
        chat: { id: 456 },
        document: { file_id: 'doc123' },
      }),
      setWebHook: vi.fn().mockResolvedValue(true),
      deleteWebHook: vi.fn().mockResolvedValue(true),
      getMe: vi.fn().mockResolvedValue({
        id: 789,
        is_bot: true,
        first_name: 'TestBot',
        username: 'test_bot',
      }),
    };

    // @ts-ignore
    vi.mocked(TelegramBot).mockImplementation(() => mockBot);
  });

  describe('sendTelegramMessage', () => {
    it('deve enviar mensagem de texto simples', async () => {
      const result = await sendTelegramMessage('123456', 'Hello, World!');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(123);
      expect(mockBot.sendMessage).toHaveBeenCalledWith('123456', 'Hello, World!', undefined);
    });

    it('deve enviar mensagem com formatação Markdown', async () => {
      const result = await sendTelegramMessage(
        '123456',
        '*Bold* and _italic_ text',
        { parse_mode: 'Markdown' }
      );

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123456',
        '*Bold* and _italic_ text',
        expect.objectContaining({ parse_mode: 'Markdown' })
      );
    });

    it('deve enviar mensagem com formatação HTML', async () => {
      const result = await sendTelegramMessage(
        '123456',
        '<b>Bold</b> and <i>italic</i>',
        { parse_mode: 'HTML' }
      );

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123456',
        '<b>Bold</b> and <i>italic</i>',
        expect.objectContaining({ parse_mode: 'HTML' })
      );
    });

    it('deve enviar mensagem com teclado inline', async () => {
      const keyboard = {
        inline_keyboard: [
          [
            { text: 'Button 1', callback_data: 'btn1' },
            { text: 'Button 2', callback_data: 'btn2' },
          ],
        ],
      };

      const result = await sendTelegramMessage('123456', 'Choose an option:', {
        reply_markup: keyboard,
      });

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123456',
        'Choose an option:',
        expect.objectContaining({ reply_markup: keyboard })
      );
    });

    it('deve enviar mensagem com desabilitação de preview de link', async () => {
      const result = await sendTelegramMessage(
        '123456',
        'Check this link: https://example.com',
        { disable_web_page_preview: true }
      );

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123456',
        'Check this link: https://example.com',
        expect.objectContaining({ disable_web_page_preview: true })
      );
    });

    it('deve enviar mensagem silenciosa', async () => {
      const result = await sendTelegramMessage('123456', 'Silent message', {
        disable_notification: true,
      });

      expect(result.success).toBe(true);
      expect(mockBot.sendMessage).toHaveBeenCalledWith(
        '123456',
        'Silent message',
        expect.objectContaining({ disable_notification: true })
      );
    });

    it('deve retornar erro quando envio falha', async () => {
      mockBot.sendMessage.mockRejectedValue(new Error('Chat not found'));

      const result = await sendTelegramMessage('invalid', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chat not found');
    });

    it('deve retornar erro quando bot token não configurado', async () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await sendTelegramMessage('123456', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TELEGRAM_BOT_TOKEN');

      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    });

    it('deve validar chatId', async () => {
      const result = await sendTelegramMessage('', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('chatId');
    });

    it('deve validar mensagem vazia', async () => {
      const result = await sendTelegramMessage('123456', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('message');
    });
  });

  describe('sendTelegramPhoto', () => {
    it('deve enviar foto com sucesso', async () => {
      const result = await sendTelegramPhoto('123456', '/path/to/photo.jpg');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(124);
      expect(mockBot.sendPhoto).toHaveBeenCalledWith('123456', '/path/to/photo.jpg', undefined);
    });

    it('deve enviar foto com legenda', async () => {
      const result = await sendTelegramPhoto('123456', '/path/to/photo.jpg', {
        caption: 'Beautiful photo',
      });

      expect(result.success).toBe(true);
      expect(mockBot.sendPhoto).toHaveBeenCalledWith(
        '123456',
        '/path/to/photo.jpg',
        expect.objectContaining({ caption: 'Beautiful photo' })
      );
    });

    it('deve enviar foto com legenda formatada', async () => {
      const result = await sendTelegramPhoto('123456', '/path/to/photo.jpg', {
        caption: '*Bold caption*',
        parse_mode: 'Markdown',
      });

      expect(result.success).toBe(true);
      expect(mockBot.sendPhoto).toHaveBeenCalledWith(
        '123456',
        '/path/to/photo.jpg',
        expect.objectContaining({
          caption: '*Bold caption*',
          parse_mode: 'Markdown',
        })
      );
    });

    it('deve enviar foto por URL', async () => {
      const result = await sendTelegramPhoto('123456', 'https://example.com/photo.jpg');

      expect(result.success).toBe(true);
      expect(mockBot.sendPhoto).toHaveBeenCalledWith(
        '123456',
        'https://example.com/photo.jpg',
        undefined
      );
    });

    it('deve retornar erro quando arquivo não existe', async () => {
      mockBot.sendPhoto.mockRejectedValue(new Error('File not found'));

      const result = await sendTelegramPhoto('123456', '/invalid/path.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('deve retornar erro quando bot token não configurado', async () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await sendTelegramPhoto('123456', '/path/photo.jpg');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TELEGRAM_BOT_TOKEN');

      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    });
  });

  describe('sendTelegramDocument', () => {
    it('deve enviar documento com sucesso', async () => {
      const result = await sendTelegramDocument('123456', '/path/to/document.pdf');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe(125);
      expect(mockBot.sendDocument).toHaveBeenCalledWith(
        '123456',
        '/path/to/document.pdf',
        undefined
      );
    });

    it('deve enviar documento com legenda', async () => {
      const result = await sendTelegramDocument('123456', '/path/to/document.pdf', {
        caption: 'Important document',
      });

      expect(result.success).toBe(true);
      expect(mockBot.sendDocument).toHaveBeenCalledWith(
        '123456',
        '/path/to/document.pdf',
        expect.objectContaining({ caption: 'Important document' })
      );
    });

    it('deve enviar documento por URL', async () => {
      const result = await sendTelegramDocument('123456', 'https://example.com/doc.pdf');

      expect(result.success).toBe(true);
      expect(mockBot.sendDocument).toHaveBeenCalledWith(
        '123456',
        'https://example.com/doc.pdf',
        undefined
      );
    });

    it('deve retornar erro quando arquivo não existe', async () => {
      mockBot.sendDocument.mockRejectedValue(new Error('File not found'));

      const result = await sendTelegramDocument('123456', '/invalid/path.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('deve retornar erro quando bot token não configurado', async () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await sendTelegramDocument('123456', '/path/doc.pdf');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TELEGRAM_BOT_TOKEN');

      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    });
  });

  describe('setWebhook', () => {
    it('deve configurar webhook com sucesso', async () => {
      const result = await setWebhook('https://example.com/webhook');

      expect(result.success).toBe(true);
      expect(mockBot.setWebHook).toHaveBeenCalledWith('https://example.com/webhook');
    });

    it('deve remover webhook quando URL vazia', async () => {
      const result = await setWebhook('');

      expect(result.success).toBe(true);
      expect(mockBot.deleteWebHook).toHaveBeenCalled();
    });

    it('deve retornar erro quando configuração falha', async () => {
      mockBot.setWebHook.mockRejectedValue(new Error('Invalid URL'));

      const result = await setWebhook('invalid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('deve retornar erro quando bot token não configurado', async () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await setWebhook('https://example.com/webhook');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TELEGRAM_BOT_TOKEN');

      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    });
  });

  describe('verifyTelegramConfig', () => {
    it('deve verificar configuração válida', async () => {
      const result = await verifyTelegramConfig();

      expect(result.configured).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.botInfo).toBeDefined();
      expect(result.botInfo?.username).toBe('test_bot');
      expect(mockBot.getMe).toHaveBeenCalled();
    });

    it('deve detectar token inválido', async () => {
      mockBot.getMe.mockRejectedValue(new Error('Invalid token'));

      const result = await verifyTelegramConfig();

      expect(result.configured).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Invalid token');
    });

    it('deve detectar token ausente', async () => {
      const originalToken = process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.TELEGRAM_BOT_TOKEN;

      const result = await verifyTelegramConfig();

      expect(result.configured).toBe(false);
      expect(result.verified).toBe(false);

      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com timeout', async () => {
      mockBot.sendMessage.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await sendTelegramMessage('123456', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('deve lidar com erro de rede', async () => {
      mockBot.sendMessage.mockRejectedValue(new Error('Network error'));

      const result = await sendTelegramMessage('123456', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('deve lidar com bot bloqueado pelo usuário', async () => {
      mockBot.sendMessage.mockRejectedValue(new Error('Bot was blocked by the user'));

      const result = await sendTelegramMessage('123456', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('blocked');
    });

    it('deve lidar com chat não encontrado', async () => {
      mockBot.sendMessage.mockRejectedValue(new Error('Chat not found'));

      const result = await sendTelegramMessage('invalid-chat', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Chat not found');
    });

    it('deve lidar com mensagem muito longa', async () => {
      mockBot.sendMessage.mockRejectedValue(new Error('Message is too long'));

      const longMessage = 'a'.repeat(5000);
      const result = await sendTelegramMessage('123456', longMessage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('too long');
    });
  });
});
