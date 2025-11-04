import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  addContactToMailchimp,
  removeContactFromMailchimp,
  createMailchimpCampaign,
  sendMailchimpCampaign,
  syncLeadsToMailchimp,
  verifyIntegrations,
} from '../../src/services/marketing.service';

// Mock do Mailchimp client
vi.mock('@mailchimp/mailchimp_marketing', () => ({
  default: {
    setConfig: vi.fn(),
    lists: {
      addListMember: vi.fn(),
      deleteListMember: vi.fn(),
      getList: vi.fn(),
    },
    campaigns: {
      create: vi.fn(),
      send: vi.fn(),
      get: vi.fn(),
    },
    ping: {
      get: vi.fn(),
    },
  },
}));

describe('Marketing Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addContactToMailchimp', () => {
    it('deve adicionar contato ao Mailchimp com sucesso', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockResolvedValue({
        id: 'member123',
        email_address: 'test@example.com',
        status: 'subscribed',
      });

      const result = await addContactToMailchimp({
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        listId: 'list123',
      });

      expect(result.success).toBe(true);
      expect(result.memberId).toBe('member123');
      expect(mailchimp.lists.addListMember).toHaveBeenCalledWith(
        'list123',
        expect.objectContaining({
          email_address: 'test@example.com',
          status: 'subscribed',
        })
      );
    });

    it('deve adicionar contato com tags', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockResolvedValue({
        id: 'member456',
        status: 'subscribed',
      });

      await addContactToMailchimp({
        email: 'test@example.com',
        listId: 'list123',
        tags: ['lead', 'interested'],
      });

      expect(mailchimp.lists.addListMember).toHaveBeenCalledWith(
        'list123',
        expect.objectContaining({
          tags: ['lead', 'interested'],
        })
      );
    });

    it('deve adicionar contato com merge fields customizados', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockResolvedValue({
        id: 'member789',
        status: 'subscribed',
      });

      await addContactToMailchimp({
        email: 'test@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
        listId: 'list123',
        mergeFields: {
          PHONE: '+5511999999999',
          COMPANY: 'Tech Corp',
        },
      });

      expect(mailchimp.lists.addListMember).toHaveBeenCalledWith(
        'list123',
        expect.objectContaining({
          merge_fields: expect.objectContaining({
            FNAME: 'Jane',
            LNAME: 'Smith',
            PHONE: '+5511999999999',
            COMPANY: 'Tech Corp',
          }),
        })
      );
    });

    it('deve retornar erro quando Mailchimp não configurado', async () => {
      const originalKey = process.env.MAILCHIMP_API_KEY;
      delete process.env.MAILCHIMP_API_KEY;

      const result = await addContactToMailchimp({
        email: 'test@example.com',
        listId: 'list123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('MAILCHIMP');

      process.env.MAILCHIMP_API_KEY = originalKey;
    });

    it('deve retornar erro quando email já existe', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockRejectedValue({
        status: 400,
        title: 'Member Exists',
      });

      const result = await addContactToMailchimp({
        email: 'existing@example.com',
        listId: 'list123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Member Exists');
    });

    it('deve validar email', async () => {
      const result = await addContactToMailchimp({
        email: 'invalid-email',
        listId: 'list123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('removeContactFromMailchimp', () => {
    it('deve remover contato do Mailchimp', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.deleteListMember.mockResolvedValue({});

      const result = await removeContactFromMailchimp('test@example.com', 'list123');

      expect(result.success).toBe(true);
      expect(mailchimp.lists.deleteListMember).toHaveBeenCalled();
    });

    it('deve retornar erro quando contato não existe', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.deleteListMember.mockRejectedValue({
        status: 404,
        title: 'Resource Not Found',
      });

      const result = await removeContactFromMailchimp('nonexistent@example.com', 'list123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not Found');
    });

    it('deve retornar erro quando Mailchimp não configurado', async () => {
      const originalKey = process.env.MAILCHIMP_API_KEY;
      delete process.env.MAILCHIMP_API_KEY;

      const result = await removeContactFromMailchimp('test@example.com', 'list123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('MAILCHIMP');

      process.env.MAILCHIMP_API_KEY = originalKey;
    });
  });

  describe('createMailchimpCampaign', () => {
    it('deve criar campanha no Mailchimp', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.campaigns.create.mockResolvedValue({
        id: 'campaign123',
        status: 'save',
        settings: {
          subject_line: 'Test Campaign',
        },
      });

      const result = await createMailchimpCampaign({
        listId: 'list123',
        subject: 'Test Campaign',
        fromName: 'Company Name',
        replyTo: 'reply@example.com',
        content: '<h1>Hello</h1><p>Campaign content</p>',
      });

      expect(result.success).toBe(true);
      expect(result.campaignId).toBe('campaign123');
      expect(mailchimp.campaigns.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'regular',
          recipients: expect.objectContaining({
            list_id: 'list123',
          }),
          settings: expect.objectContaining({
            subject_line: 'Test Campaign',
            from_name: 'Company Name',
            reply_to: 'reply@example.com',
          }),
        })
      );
    });

    it('deve criar campanha com segmentação', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.campaigns.create.mockResolvedValue({
        id: 'campaign456',
        status: 'save',
      });

      await createMailchimpCampaign({
        listId: 'list123',
        subject: 'Segmented Campaign',
        fromName: 'Company',
        replyTo: 'reply@example.com',
        content: 'Content',
        segmentOptions: {
          match: 'all',
          conditions: [
            {
              field: 'interests',
              op: 'interestcontains',
              value: 'interest123',
            },
          ],
        },
      });

      expect(mailchimp.campaigns.create).toHaveBeenCalledWith(
        expect.objectContaining({
          recipients: expect.objectContaining({
            segment_opts: expect.any(Object),
          }),
        })
      );
    });

    it('deve retornar erro quando Mailchimp não configurado', async () => {
      const originalKey = process.env.MAILCHIMP_API_KEY;
      delete process.env.MAILCHIMP_API_KEY;

      const result = await createMailchimpCampaign({
        listId: 'list123',
        subject: 'Test',
        fromName: 'Test',
        replyTo: 'test@example.com',
        content: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('MAILCHIMP');

      process.env.MAILCHIMP_API_KEY = originalKey;
    });
  });

  describe('sendMailchimpCampaign', () => {
    it('deve enviar campanha criada', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.campaigns.send.mockResolvedValue({});

      const result = await sendMailchimpCampaign('campaign123');

      expect(result.success).toBe(true);
      expect(mailchimp.campaigns.send).toHaveBeenCalledWith('campaign123');
    });

    it('deve retornar erro quando campanha não existe', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.campaigns.send.mockRejectedValue({
        status: 404,
        title: 'Resource Not Found',
      });

      const result = await sendMailchimpCampaign('nonexistent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Not Found');
    });

    it('deve retornar erro quando campanha já foi enviada', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.campaigns.send.mockRejectedValue({
        status: 400,
        title: 'Campaign Already Sent',
      });

      const result = await sendMailchimpCampaign('campaign123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Already Sent');
    });

    it('deve retornar erro quando Mailchimp não configurado', async () => {
      const originalKey = process.env.MAILCHIMP_API_KEY;
      delete process.env.MAILCHIMP_API_KEY;

      const result = await sendMailchimpCampaign('campaign123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('MAILCHIMP');

      process.env.MAILCHIMP_API_KEY = originalKey;
    });
  });

  describe('syncLeadsToMailchimp', () => {
    it('deve sincronizar múltiplos leads', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockResolvedValue({
        id: 'member',
        status: 'subscribed',
      });

      const leads = [
        { email: 'lead1@example.com', firstName: 'Lead', lastName: '1' },
        { email: 'lead2@example.com', firstName: 'Lead', lastName: '2' },
        { email: 'lead3@example.com', firstName: 'Lead', lastName: '3' },
      ];

      const result = await syncLeadsToMailchimp(leads, 'list123');

      expect(result.success).toBe(true);
      expect(result.synced).toBe(3);
      expect(result.failed).toBe(0);
      expect(mailchimp.lists.addListMember).toHaveBeenCalledTimes(3);
    });

    it('deve continuar sincronizando mesmo se um falhar', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember
        .mockResolvedValueOnce({ id: 'member1', status: 'subscribed' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ id: 'member3', status: 'subscribed' });

      const leads = [
        { email: 'lead1@example.com' },
        { email: 'lead2@example.com' },
        { email: 'lead3@example.com' },
      ];

      const result = await syncLeadsToMailchimp(leads, 'list123');

      expect(result.success).toBe(true);
      expect(result.synced).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('deve retornar array vazio para entrada vazia', async () => {
      const result = await syncLeadsToMailchimp([], 'list123');

      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('deve incluir detalhes de cada sincronização', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockResolvedValue({
        id: 'member',
        status: 'subscribed',
      });

      const leads = [{ email: 'test@example.com' }];

      const result = await syncLeadsToMailchimp(leads, 'list123');

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toHaveProperty('email');
      expect(result.results[0]).toHaveProperty('success');
    });
  });

  describe('verifyIntegrations', () => {
    it('deve verificar Mailchimp configurado e funcionando', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.ping.get.mockResolvedValue({
        health_status: 'Everything\'s Chimpy!',
      });

      const result = await verifyIntegrations();

      expect(result.mailchimp.configured).toBe(true);
      expect(result.mailchimp.working).toBe(true);
      expect(mailchimp.ping.get).toHaveBeenCalled();
    });

    it('deve detectar Mailchimp não configurado', async () => {
      const originalKey = process.env.MAILCHIMP_API_KEY;
      delete process.env.MAILCHIMP_API_KEY;

      const result = await verifyIntegrations();

      expect(result.mailchimp.configured).toBe(false);
      expect(result.mailchimp.working).toBe(false);

      process.env.MAILCHIMP_API_KEY = originalKey;
    });

    it('deve detectar Mailchimp configurado mas não funcionando', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.ping.get.mockRejectedValue(new Error('API Error'));

      const result = await verifyIntegrations();

      expect(result.mailchimp.configured).toBe(true);
      expect(result.mailchimp.working).toBe(false);
      expect(result.mailchimp.error).toContain('API Error');
    });

    it('deve verificar Google Ads não configurado', async () => {
      const result = await verifyIntegrations();

      // Google Ads geralmente não está configurado em testes
      expect(result.googleAds).toBeDefined();
      expect(result.googleAds).toHaveProperty('configured');
    });

    it('deve retornar status de todas as integrações', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.ping.get.mockResolvedValue({ health_status: 'OK' });

      const result = await verifyIntegrations();

      expect(result).toHaveProperty('mailchimp');
      expect(result).toHaveProperty('googleAds');
      expect(result.mailchimp).toHaveProperty('configured');
      expect(result.mailchimp).toHaveProperty('working');
      expect(result.googleAds).toHaveProperty('configured');
    });
  });

  describe('Error Handling', () => {
    it('deve lidar com timeout do Mailchimp', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      );

      const result = await addContactToMailchimp({
        email: 'test@example.com',
        listId: 'list123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
    });

    it('deve lidar com erro de rede', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockRejectedValue(new Error('Network error'));

      const result = await addContactToMailchimp({
        email: 'test@example.com',
        listId: 'list123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('deve lidar com API key inválida', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockRejectedValue({
        status: 401,
        title: 'API Key Invalid',
      });

      const result = await addContactToMailchimp({
        email: 'test@example.com',
        listId: 'list123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('API Key Invalid');
    });

    it('deve lidar com lista não encontrada', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockRejectedValue({
        status: 404,
        title: 'List Not Found',
      });

      const result = await addContactToMailchimp({
        email: 'test@example.com',
        listId: 'invalid-list',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('List Not Found');
    });

    it('deve lidar com limite de taxa excedido', async () => {
      const mailchimp = require('@mailchimp/mailchimp_marketing').default;
      mailchimp.lists.addListMember.mockRejectedValue({
        status: 429,
        title: 'Too Many Requests',
      });

      const result = await addContactToMailchimp({
        email: 'test@example.com',
        listId: 'list123',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Too Many Requests');
    });
  });
});
