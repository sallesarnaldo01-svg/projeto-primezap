import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';

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
router.get('/integrations', authMiddleware, integrationsController.getIntegrations);
router.get('/integrations/:id', authMiddleware, integrationsController.getIntegration);
router.post('/integrations', authMiddleware, integrationsController.createIntegration);
router.put('/integrations/:id', authMiddleware, integrationsController.updateIntegration);
router.delete('/integrations/:id', authMiddleware, integrationsController.deleteIntegration);
router.post('/integrations/:id/test', authMiddleware, integrationsController.testIntegration);
router.post('/integrations/:id/sync', authMiddleware, integrationsController.syncIntegration);

// Conversations routes
router.get('/conversations', authMiddleware, conversationsController.getConversations);
router.get('/conversations/:id', authMiddleware, conversationsController.getConversation);
router.post('/conversations', authMiddleware, conversationsController.createConversation);
router.put('/conversations/:id', authMiddleware, conversationsController.updateConversation);
router.delete('/conversations/:id', authMiddleware, conversationsController.deleteConversation);
router.post('/conversations/:id/archive', authMiddleware, conversationsController.archiveConversation);
router.post('/conversations/:id/messages', authMiddleware, conversationsController.sendMessage);
router.post('/conversations/:id/mark-as-read', authMiddleware, conversationsController.markAsRead);

// Campaigns routes
router.get('/campaigns', authMiddleware, campaignsController.getCampaigns);
router.get('/campaigns/:id', authMiddleware, campaignsController.getCampaign);
router.post('/campaigns', authMiddleware, campaignsController.createCampaign);
router.put('/campaigns/:id', authMiddleware, campaignsController.updateCampaign);
router.delete('/campaigns/:id', authMiddleware, campaignsController.deleteCampaign);
router.post('/campaigns/:id/start', authMiddleware, campaignsController.startCampaign);
router.post('/campaigns/:id/pause', authMiddleware, campaignsController.pauseCampaign);
router.post('/campaigns/:id/cancel', authMiddleware, campaignsController.cancelCampaign);
router.get('/campaigns/:id/stats', authMiddleware, campaignsController.getCampaignStats);

// Scheduled Campaigns
router.get('/scheduled-campaigns', authMiddleware, scheduledCampaignsController.list);
router.get('/scheduled-campaigns/:campaignId', authMiddleware, scheduledCampaignsController.get);
router.post('/scheduled-campaigns', authMiddleware, scheduledCampaignsController.create);
router.put('/scheduled-campaigns/:campaignId', authMiddleware, scheduledCampaignsController.update);
router.delete('/scheduled-campaigns/:campaignId', authMiddleware, scheduledCampaignsController.remove);
router.post('/scheduled-campaigns/:campaignId/start', authMiddleware, scheduledCampaignsController.startNow);
router.post('/scheduled-campaigns/:campaignId/pause', authMiddleware, scheduledCampaignsController.pause);
router.post('/scheduled-campaigns/:campaignId/resume', authMiddleware, scheduledCampaignsController.resume);
router.post('/scheduled-campaigns/:campaignId/cancel', authMiddleware, scheduledCampaignsController.cancel);

// Appointments
router.get('/appointments', authMiddleware, appointmentsController.list);
router.get('/appointments/:appointmentId', authMiddleware, appointmentsController.get);
router.post('/appointments', authMiddleware, appointmentsController.create);
router.put('/appointments/:appointmentId', authMiddleware, appointmentsController.update);
router.post('/appointments/:appointmentId/confirm', authMiddleware, appointmentsController.confirm);
router.post('/appointments/:appointmentId/cancel', authMiddleware, appointmentsController.cancel);
router.delete('/appointments/:appointmentId', authMiddleware, appointmentsController.remove);

// AI Settings
router.get('/ai/configuration', authMiddleware, aiSettingsController.getConfiguration);
router.post('/ai/configuration', authMiddleware, aiSettingsController.upsertConfiguration);
router.delete('/ai/configuration', authMiddleware, aiSettingsController.deleteConfiguration);
router.get('/ai/auto-replies', authMiddleware, aiSettingsController.listAutoReplies);

export default router;
