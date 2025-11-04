import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sendEmail,
  sendBulkEmails,
  sendTemplateEmail,
  verifyEmailConfig,
} from '../../src/services/email.service';
import nodemailer from 'nodemailer';

// Mock do nodemailer
vi.mock('nodemailer');

describe('Email Service', () => {
  let mockTransporter: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock do transporter
    mockTransporter = {
      sendMail: vi.fn().mockResolvedValue({
        messageId: '<test@example.com>',
        accepted: ['recipient@example.com'],
        rejected: [],
        response: '250 Message accepted',
      }),
      verify: vi.fn().mockResolvedValue(true),
    };

    // @ts-ignore
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter);
  });

  describe('sendEmail', () => {
    it('deve enviar email simples com sucesso', async () => {
      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test Email',
        text: 'This is a test email',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'recipient@example.com',
          subject: 'Test Email',
          text: 'This is a test email',
        })
      );
    });

    it('deve enviar email com HTML', async () => {
      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'HTML Email',
        html: '<h1>Test</h1><p>HTML content</p>',
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Test</h1><p>HTML content</p>',
        })
      );
    });

    it('deve enviar email com anexos', async () => {
      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Email with Attachment',
        text: 'Please see attached',
        attachments: [
          {
            filename: 'document.pdf',
            path: '/path/to/document.pdf',
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'document.pdf',
            }),
          ]),
        })
      );
    });

    it('deve enviar email com CC e BCC', async () => {
      const result = await sendEmail({
        to: 'recipient@example.com',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        subject: 'Email with CC/BCC',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: 'cc@example.com',
          bcc: 'bcc@example.com',
        })
      );
    });

    it('deve enviar email com múltiplos destinatários', async () => {
      const result = await sendEmail({
        to: ['recipient1@example.com', 'recipient2@example.com'],
        subject: 'Multiple Recipients',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['recipient1@example.com', 'recipient2@example.com'],
        })
      );
    });

    it('deve usar remetente padrão quando não especificado', async () => {
      await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
        })
      );
    });

    it('deve permitir remetente customizado', async () => {
      const result = await sendEmail({
        from: 'custom@example.com',
        to: 'recipient@example.com',
        subject: 'Custom From',
        text: 'Test',
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'custom@example.com',
        })
      );
    });

    it('deve retornar erro quando envio falha', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('SMTP error'));

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP error');
    });

    it('deve retornar erro quando credenciais não configuradas', async () => {
      const originalUser = process.env.SMTP_USER;
      delete process.env.SMTP_USER;

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('SMTP credentials');

      process.env.SMTP_USER = originalUser;
    });

    it('deve validar endereço de email', async () => {
      const result = await sendEmail({
        to: 'invalid-email',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('sendBulkEmails', () => {
    it('deve enviar múltiplos emails em lote', async () => {
      const emails = [
        {
          to: 'recipient1@example.com',
          subject: 'Email 1',
          text: 'Content 1',
        },
        {
          to: 'recipient2@example.com',
          subject: 'Email 2',
          text: 'Content 2',
        },
        {
          to: 'recipient3@example.com',
          subject: 'Email 3',
          text: 'Content 3',
        },
      ];

      const result = await sendBulkEmails(emails);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(3);
      expect(result.failed).toBe(0);
      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(3);
    });

    it('deve continuar enviando mesmo se um falhar', async () => {
      mockTransporter.sendMail
        .mockResolvedValueOnce({ messageId: 'msg1' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ messageId: 'msg3' });

      const emails = [
        { to: 'recipient1@example.com', subject: 'Test 1', text: 'Test' },
        { to: 'recipient2@example.com', subject: 'Test 2', text: 'Test' },
        { to: 'recipient3@example.com', subject: 'Test 3', text: 'Test' },
      ];

      const result = await sendBulkEmails(emails);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.results).toHaveLength(3);
    });

    it('deve retornar array vazio para entrada vazia', async () => {
      const result = await sendBulkEmails([]);

      expect(result.success).toBe(true);
      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });

    it('deve incluir detalhes de cada envio', async () => {
      const emails = [
        { to: 'recipient@example.com', subject: 'Test', text: 'Test' },
      ];

      const result = await sendBulkEmails(emails);

      expect(result.results[0]).toHaveProperty('to');
      expect(result.results[0]).toHaveProperty('success');
      expect(result.results[0]).toHaveProperty('messageId');
    });
  });

  describe('sendTemplateEmail', () => {
    it('deve enviar email usando template', async () => {
      const result = await sendTemplateEmail({
        to: 'recipient@example.com',
        template: 'welcome',
        data: {
          name: 'João Silva',
          activationLink: 'https://example.com/activate',
        },
      });

      expect(result.success).toBe(true);
      expect(mockTransporter.sendMail).toHaveBeenCalled();
    });

    it('deve substituir variáveis no template', async () => {
      await sendTemplateEmail({
        to: 'recipient@example.com',
        template: 'custom',
        subject: 'Hello {{name}}',
        text: 'Welcome {{name}}, your code is {{code}}',
        data: {
          name: 'Maria',
          code: '123456',
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Hello Maria',
          text: 'Welcome Maria, your code is 123456',
        })
      );
    });

    it('deve suportar template HTML', async () => {
      await sendTemplateEmail({
        to: 'recipient@example.com',
        template: 'html-template',
        html: '<h1>Hello {{name}}</h1>',
        data: {
          name: 'Pedro',
        },
      });

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: '<h1>Hello Pedro</h1>',
        })
      );
    });

    it('deve retornar erro quando template não existe', async () => {
      const result = await sendTemplateEmail({
        to: 'recipient@example.com',
        template: 'non-existent',
        data: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifyEmailConfig', () => {
    it('deve verificar configuração válida', async () => {
      const result = await verifyEmailConfig();

      expect(result.configured).toBe(true);
      expect(result.verified).toBe(true);
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it('deve detectar configuração inválida', async () => {
      mockTransporter.verify.mockRejectedValue(new Error('Connection failed'));

      const result = await verifyEmailConfig();

      expect(result.configured).toBe(true);
      expect(result.verified).toBe(false);
      expect(result.error).toContain('Connection failed');
    });

    it('deve detectar credenciais ausentes', async () => {
      const originalUser = process.env.SMTP_USER;
      delete process.env.SMTP_USER;

      const result = await verifyEmailConfig();

      expect(result.configured).toBe(false);
      expect(result.verified).toBe(false);

      process.env.SMTP_USER = originalUser;
    });

    it('deve retornar informações de configuração', async () => {
      const result = await verifyEmailConfig();

      expect(result).toHaveProperty('host');
      expect(result).toHaveProperty('port');
      expect(result).toHaveProperty('secure');
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com timeout de SMTP', async () => {
      mockTransporter.sendMail.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('deve lidar com erro de autenticação', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Authentication failed'));

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Authentication failed');
    });

    it('deve lidar com erro de conexão', async () => {
      mockTransporter.sendMail.mockRejectedValue(new Error('Connection refused'));

      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Connection refused');
    });

    it('deve lidar com anexo inválido', async () => {
      const result = await sendEmail({
        to: 'recipient@example.com',
        subject: 'Test',
        text: 'Test',
        attachments: [
          {
            filename: 'invalid.pdf',
            path: '/non/existent/file.pdf',
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
