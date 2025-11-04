import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendSMS,
  sendBulkSMS,
  getSMSStatus,
  sendVerificationSMS,
  verifySMSConfig,
} from '../../src/services/sms.service';
import twilio from 'twilio';

// Mock do Twilio
vi.mock('twilio');

describe('SMS Service', () => {
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock do cliente Twilio
    mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          sid: 'SM1234567890abcdef',
          status: 'queued',
          to: '+5511999999999',
          from: '+15551234567',
          body: 'Test message',
          dateCreated: new Date(),
        }),
        fetch: vi.fn().mockImplementation((sid) => ({
          fetch: vi.fn().mockResolvedValue({
            sid,
            status: 'delivered',
            to: '+5511999999999',
            from: '+15551234567',
            body: 'Test message',
            dateCreated: new Date(),
            dateSent: new Date(),
          }),
        })),
      },
      lookups: {
        v2: {
          phoneNumbers: vi.fn().mockReturnValue({
            fetch: vi.fn().mockResolvedValue({
              phoneNumber: '+5511999999999',
              valid: true,
              countryCode: 'BR',
            }),
          }),
        },
      },
    };

    // @ts-ignore
    vi.mocked(twilio).mockReturnValue(mockClient);
  });

  describe('sendSMS', () => {
    it('deve enviar SMS com sucesso', async () => {
      const result = await sendSMS('+5511999999999', 'Hello, World!');

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM1234567890abcdef');
      expect(result.status).toBe('queued');
      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+5511999999999',
          body: 'Hello, World!',
        })
      );
    });

    it('deve enviar SMS com remetente customizado', async () => {
      const result = await sendSMS('+5511999999999', 'Test', '+15559876543');

      expect(result.success).toBe(true);
      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from: '+15559876543',
        })
      );
    });

    it('deve usar número padrão quando remetente não especificado', async () => {
      await sendSMS('+5511999999999', 'Test');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
        })
      );
    });

    it('deve retornar erro quando envio falha', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Invalid phone number'));

      const result = await sendSMS('invalid', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid phone number');
    });

    it('deve retornar erro quando credenciais não configuradas', async () => {
      const originalSid = process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await sendSMS('+5511999999999', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TWILIO');

      process.env.TWILIO_ACCOUNT_SID = originalSid;
    });

    it('deve validar número de telefone', async () => {
      const result = await sendSMS('', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('phone');
    });

    it('deve validar mensagem vazia', async () => {
      const result = await sendSMS('+5511999999999', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('message');
    });

    it('deve lidar com mensagem muito longa', async () => {
      const longMessage = 'a'.repeat(2000);
      
      mockClient.messages.create.mockRejectedValue(
        new Error('Message exceeds maximum length')
      );

      const result = await sendSMS('+5511999999999', longMessage);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('deve incluir statusCallback se fornecido', async () => {
      await sendSMS('+5511999999999', 'Test', undefined, {
        statusCallback: 'https://example.com/callback',
      });

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCallback: 'https://example.com/callback',
        })
      );
    });
  });

  describe('sendBulkSMS', () => {
    it('deve enviar múltiplos SMS em lote', async () => {
      const messages = [
        { to: '+5511999999991', message: 'Message 1' },
        { to: '+5511999999992', message: 'Message 2' },
        { to: '+5511999999993', message: 'Message 3' },
      ];

      const result = await sendBulkSMS(messages);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockClient.messages.create).toHaveBeenCalledTimes(3);
    });

    it('deve continuar enviando mesmo se um falhar', async () => {
      mockClient.messages.create
        .mockResolvedValueOnce({ sid: 'SM1', status: 'queued' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ sid: 'SM3', status: 'queued' });

      const messages = [
        { to: '+5511999999991', message: 'Message 1' },
        { to: '+5511999999992', message: 'Message 2' },
        { to: '+5511999999993', message: 'Message 3' },
      ];

      const result = await sendBulkSMS(messages);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
    });

    it('deve retornar array vazio para entrada vazia', async () => {
      const result = await sendBulkSMS([]);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('deve incluir detalhes de cada envio', async () => {
      const messages = [{ to: '+5511999999999', message: 'Test' }];

      const result = await sendBulkSMS(messages);

      expect(result.results[0]).toHaveProperty('to');
      expect(result.results[0]).toHaveProperty('success');
      expect(result.results[0]).toHaveProperty('messageId');
    });

    it('deve usar remetente customizado para todos', async () => {
      const messages = [
        { to: '+5511999999991', message: 'Message 1' },
        { to: '+5511999999992', message: 'Message 2' },
      ];

      await sendBulkSMS(messages, '+15559876543');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({ from: '+15559876543' })
      );
    });
  });

  describe('getSMSStatus', () => {
    it('deve consultar status de SMS enviado', async () => {
      const result = await getSMSStatus('SM1234567890abcdef');

      expect(result.success).toBe(true);
      expect(result.status).toBe('delivered');
      expect(result.messageId).toBe('SM1234567890abcdef');
    });

    it('deve retornar erro quando messageId inválido', async () => {
      mockClient.messages.fetch.mockImplementation(() => ({
        fetch: vi.fn().mockRejectedValue(new Error('Message not found')),
      }));

      const result = await getSMSStatus('invalid-sid');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Message not found');
    });

    it('deve retornar erro quando credenciais não configuradas', async () => {
      const originalSid = process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await getSMSStatus('SM1234567890abcdef');

      expect(result.success).toBe(false);
      expect(result.error).toContain('TWILIO');

      process.env.TWILIO_ACCOUNT_SID = originalSid;
    });

    it('deve incluir informações detalhadas do status', async () => {
      const result = await getSMSStatus('SM1234567890abcdef');

      expect(result).toHaveProperty('to');
      expect(result).toHaveProperty('from');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('dateCreated');
    });
  });

  describe('sendVerificationSMS', () => {
    it('deve enviar SMS de verificação com código', async () => {
      const result = await sendVerificationSMS('+5511999999999', '123456');

      expect(result.success).toBe(true);
      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          to: '+5511999999999',
          body: expect.stringContaining('123456'),
        })
      );
    });

    it('deve incluir nome da aplicação na mensagem', async () => {
      await sendVerificationSMS('+5511999999999', '123456', 'MyApp');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.stringContaining('MyApp'),
        })
      );
    });

    it('deve usar nome padrão quando não especificado', async () => {
      await sendVerificationSMS('+5511999999999', '123456');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.any(String),
        })
      );
    });

    it('deve validar código de verificação', async () => {
      const result = await sendVerificationSMS('+5511999999999', '');

      expect(result.success).toBe(false);
      expect(result.error).toContain('code');
    });

    it('deve retornar erro quando envio falha', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('SMS failed'));

      const result = await sendVerificationSMS('+5511999999999', '123456');

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMS failed');
    });
  });

  describe('verifySMSConfig', () => {
    it('deve verificar configuração válida', async () => {
      const result = await verifySMSConfig();

      expect(result.configured).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('deve detectar credenciais ausentes', async () => {
      const originalSid = process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_ACCOUNT_SID;

      const result = await verifySMSConfig();

      expect(result.configured).toBe(false);
      expect(result.verified).toBe(false);

      process.env.TWILIO_ACCOUNT_SID = originalSid;
    });

    it('deve detectar credenciais inválidas', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Authentication failed'));

      const result = await verifySMSConfig();

      expect(result.configured).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('deve retornar informações de configuração', async () => {
      const result = await verifySMSConfig();

      expect(result).toHaveProperty('accountSid');
      expect(result).toHaveProperty('fromNumber');
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com timeout', async () => {
      mockClient.messages.create.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await sendSMS('+5511999999999', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('deve lidar com erro de rede', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Network error'));

      const result = await sendSMS('+5511999999999', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('deve lidar com número bloqueado', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Number is blocked'));

      const result = await sendSMS('+5511999999999', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('blocked');
    });

    it('deve lidar com saldo insuficiente', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Insufficient funds'));

      const result = await sendSMS('+5511999999999', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient funds');
    });

    it('deve lidar com número inválido', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Invalid phone number format'));

      const result = await sendSMS('invalid-number', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid');
    });

    it('deve lidar com país não suportado', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Country not supported'));

      const result = await sendSMS('+999999999999', 'Test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not supported');
    });
  });
});
