import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';

// Import controllers
import * as integrationsController from '../controllers/integrations.controller';
import * as conversationsController from '../controllers/conversations.controller';
import * as campaignsController from '../controllers/campaigns.controller';
import { scheduledCampaignsController } from '../controllers/scheduled-campaigns.controller.js';
import { appointmentsController } from '../controllers/appointments.controller.js';
import { aiSettingsController } from '../controllers/ai-settings.controller.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Integrations routes
router.get('/integrations', authenticate, integrationsController.getIntegrations);
router.get('/integrations/:id', authenticate, integrationsController.getIntegration);
router.post('/integrations', authenticate, integrationsController.createIntegration);
router.put('/integrations/:id', authenticate, integrationsController.updateIntegration);
router.delete('/integrations/:id', authenticate, integrationsController.deleteIntegration);
router.post('/integrations/:id/test', authenticate, integrationsController.testIntegration);
router.post('/integrations/:id/sync', authenticate, integrationsController.syncIntegration);

// Conversations routes
router.get('/conversations', authenticate, conversationsController.getConversations);
router.get('/conversations/:id', authenticate, conversationsController.getConversation);
router.post('/conversations', authenticate, conversationsController.createConversation);
router.put('/conversations/:id', authenticate, conversationsController.updateConversation);
router.delete('/conversations/:id', authenticate, conversationsController.deleteConversation);
router.post('/conversations/:id/archive', authenticate, conversationsController.archiveConversation);
router.post('/conversations/:id/messages', authenticate, conversationsController.sendMessage);
router.post('/conversations/:id/mark-as-read', authenticate, conversationsController.markAsRead);

// Campaigns routes
router.get('/campaigns', authenticate, campaignsController.getCampaigns);
router.get('/campaigns/:id', authenticate, campaignsController.getCampaign);
router.post('/campaigns', authenticate, campaignsController.createCampaign);
router.put('/campaigns/:id', authenticate, campaignsController.updateCampaign);
router.delete('/campaigns/:id', authenticate, campaignsController.deleteCampaign);
router.post('/campaigns/:id/start', authenticate, campaignsController.startCampaign);
router.post('/campaigns/:id/pause', authenticate, campaignsController.pauseCampaign);
router.post('/campaigns/:id/cancel', authenticate, campaignsController.cancelCampaign);
router.get('/campaigns/:id/stats', authenticate, campaignsController.getCampaignStats);

// Scheduled Campaigns
router.get('/scheduled-campaigns', authenticate, scheduledCampaignsController.list);
router.get('/scheduled-campaigns/:campaignId', authenticate, scheduledCampaignsController.get);
router.post('/scheduled-campaigns', authenticate, scheduledCampaignsController.create);
router.put('/scheduled-campaigns/:campaignId', authenticate, scheduledCampaignsController.update);
router.delete('/scheduled-campaigns/:campaignId', authenticate, scheduledCampaignsController.remove);
router.post('/scheduled-campaigns/:campaignId/start', authenticate, scheduledCampaignsController.startNow);
router.post('/scheduled-campaigns/:campaignId/pause', authenticate, scheduledCampaignsController.pause);
router.post('/scheduled-campaigns/:campaignId/resume', authenticate, scheduledCampaignsController.resume);
router.post('/scheduled-campaigns/:campaignId/cancel', authenticate, scheduledCampaignsController.cancel);

// Appointments
router.get('/appointments', authenticate, appointmentsController.list);
router.get('/appointments/:appointmentId', authenticate, appointmentsController.get);
router.post('/appointments', authenticate, appointmentsController.create);
router.put('/appointments/:appointmentId', authenticate, appointmentsController.update);
router.post('/appointments/:appointmentId/confirm', authenticate, appointmentsController.confirm);
router.post('/appointments/:appointmentId/cancel', authenticate, appointmentsController.cancel);
router.delete('/appointments/:appointmentId', authenticate, appointmentsController.remove);

// AI Settings
router.get('/ai/configuration', authenticate, aiSettingsController.getConfiguration);
router.post('/ai/configuration', authenticate, aiSettingsController.upsertConfiguration);
router.delete('/ai/configuration', authenticate, aiSettingsController.deleteConfiguration);
router.get('/ai/auto-replies', authenticate, aiSettingsController.listAutoReplies);

export default router;
