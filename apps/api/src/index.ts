import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import pinoHttp from 'pino-http';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { connectDatabase } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { initializeSocket } from './lib/socket.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import flowsRoutes from './routes/flows.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import integrationsRoutes from './routes/integrations.routes.js';
import authLoginRoute from './routes/auth.login.js';
import { ensureInitialAdmin } from './bootstrap/ensure-admin.js';

const app = express();
const httpServer = createServer(app);

// Middleware
// Disable ETag to avoid 304 on short-poll endpoints (e.g., WhatsApp QR/status)
app.set('etag', false);
app.use(helmet());
const envOrigins = env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
const allowedOrigins = Array.from(
  new Set([
    ...envOrigins,
    'https://primezap.primezapia.com',
    'http://localhost:5173',
  ])
);

app.set('trust proxy', 1);
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    logger.warn({ origin }, 'Blocked by CORS');
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'X-Tenant-Id'],
};

app.use(cors(corsOptions));
// Ensure preflight is handled by API when it reaches upstream (Nginx may 204 early)
// Preflight handled at the edge (Nginx). No global OPTIONS handler here to avoid path-to-regexp wildcard issues on Express 5.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));
// Basic rate limiting (configurable via RATE_LIMIT_* envs)
const rateLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const url = req.originalUrl || req.url || '';
    // Always allow healthz and health endpoints
    if (
      url.startsWith('/health') ||
      url.startsWith('/healthz') ||
      url.startsWith('/api/health') ||
      url.startsWith('/api/healthz')
    ) {
      return true;
    }
    // Allow WhatsApp QR polling and status checks (high-frequency, short-lived)
    if (
      url.startsWith('/api/whatsapp/qr/') ||
      /\/api\/whatsapp\/[A-Za-z0-9-]+\/qr/.test(url) ||
      /\/api\/whatsapp\/[A-Za-z0-9-]+\/status/.test(url)
    ) {
      return true;
    }
    return false;
  },
});
app.use(rateLimiter);
app.use(authLoginRoute);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Additional health endpoints for deploy and probes
app.get('/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/api/healthz', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

// Routes
import connectionsRoutes from './routes/connections.routes.js';
import queuesRoutes from './routes/queues.routes.js';
import broadcastsRoutes from './routes/broadcasts.routes.js';
import campaignsRoutes from './routes/campaigns.routes.js';
import scrumRoutes from './routes/scrum.routes.js';
import videoCallRoutes from './routes/video-call.routes.js';
import facebookRoutes from './routes/facebook.routes.js';
import instagramRoutes from './routes/instagram.routes.js';
import aiProvidersRoutes from './routes/ai-providers.routes.js';
import aiToolsRoutes from './routes/ai-tools.routes.js';
import knowledgeRoutes from './routes/knowledge.routes.js';
import productsRoutes from './routes/products.routes.js';
import mediaRoutes from './routes/media.routes.js';
import followupCadenceRoutes from './routes/followup-cadence.routes.js';
import customFieldsRoutes from './routes/custom-fields.routes.js';
import aiUsageRoutes from './routes/ai-usage.routes.js';
import leadsRoutes from './routes/leads.routes.js';
import conversationsRoutes from './routes/conversations.routes.js';
import conversationEventsRoutes from './routes/conversation-events.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import crmRoutes from './routes/crm.routes.js';
import dealsRoutes from './routes/deals.routes.js';
import contactsRoutes from './routes/contacts.routes.js';
import ticketsRoutes from './routes/tickets.routes.js';
import usersRoutes from './routes/users.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import messagesRoutes from './routes/messages.routes.js';
import tagsRoutes from './routes/tags.routes.js';
import contactListsRoutes from './routes/contact-lists.routes.js';
import companiesRoutes from './routes/companies.routes.js';
import workflowsRoutes from './routes/workflows.routes.js';
import callsRoutes from './routes/calls.routes.js';
import commissionsRoutes from './routes/commissions.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import appointmentsRoutes from './routes/appointments.routes.js';
import reportsCrmRoutes from './routes/reports-crm.routes.js';
import internalChatRoutes from './routes/internal-chat.routes.js';
import propertiesRoutes from './routes/properties.routes.js';
import messageTemplatesRoutes from './routes/message-templates.routes.js';
import preCadastrosRoutes from './routes/pre-cadastros.routes.js';
import correspondentesRoutes from './routes/correspondentes.routes.js';
import empreendimentosRoutes from './routes/empreendimentos.routes.js';
import simulacoesRoutes from './routes/simulacoes.routes.js';
import leadInteractionsRoutes from './routes/lead-interactions.routes.js';
import documentosRoutes from './routes/documentos.routes.js';
import leadEnhancementsRoutes from './routes/lead-enhancements.routes.js';
import leadActionsRoutes from './routes/lead-actions.routes.js';
import insightsRoutes from './routes/insights.routes.js';
import dealInteractionsRoutes from './routes/deal-interactions.routes.js';
import emailRoutes from './routes/email.routes.js';
import telegramRoutes from './routes/telegram.routes.js';
import smsRoutes from './routes/sms.routes.js';
import voiceAiRoutes from './routes/voice-ai.routes.js';
import marketingRoutes from './routes/marketing.routes.js';
// notificationsRoutes imported once above
import visitsRoutes from './routes/visits.routes.js';

app.use('/api/auth', authRoutes);
app.use('/api/flows', flowsRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/queues', queuesRoutes);
app.use('/api/broadcasts', broadcastsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/scrum', scrumRoutes);
app.use('/api/video-call', videoCallRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/ai', aiProvidersRoutes);
app.use('/api/ai/tools', aiToolsRoutes);
app.use('/api/ai/knowledge', knowledgeRoutes);
app.use('/api/ai/cadences', followupCadenceRoutes);
app.use('/api/ai/usage', aiUsageRoutes);
app.use('/api/custom-fields', customFieldsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/visits', visitsRoutes);
app.use('/api/media', mediaRoutes);
// Conversas (CRUD e mensagens)
app.use('/api/conversations', conversationsRoutes);
// Eventos/timeline de conversas
app.use('/api/conversations', conversationEventsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/deals', dealsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/tags', tagsRoutes);
app.use('/api/contact-lists', contactListsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/workflows', workflowsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/commissions', commissionsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/reports/crm', reportsCrmRoutes);
app.use('/api/internal-chat', internalChatRoutes);
app.use('/api/message-templates', messageTemplatesRoutes);
app.use('/api/pre-cadastros', preCadastrosRoutes);
app.use('/api/correspondentes', correspondentesRoutes);
app.use('/api/empreendimentos', empreendimentosRoutes);
app.use('/simulacoes', simulacoesRoutes);
app.use('/api/lead-interactions', leadInteractionsRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/leads', leadEnhancementsRoutes);
app.use('/api/lead-actions', leadActionsRoutes);
app.use('/api/deal-interactions', dealInteractionsRoutes);
app.use('/api/insights', insightsRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/sms', smsRoutes);
app.use('/api/voice-ai', voiceAiRoutes);
app.use('/api/marketing', marketingRoutes);
// duplicate removed

app.get('/', (req, res) => {
  res.status(200).json({ name: 'primeflow-api', status: 'ok', docs: '/docs', health: '/health' });
});

// Error handler
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path
  });
});

// Initialize
async function start() {
  try {
    console.log('🚀 Iniciando servidor...');
    await connectDatabase();
    console.log('👤 Verificando admin inicial...');
    await ensureInitialAdmin();
    console.log('📡 Testando conexão Redis...');
    await redis.ping();
    console.log('✅ Redis ping OK');
    initializeSocket(httpServer);

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 API Server running on port ${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 CORS enabled for: ${env.FRONTEND_ORIGIN}`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

start();

export { app, httpServer };
