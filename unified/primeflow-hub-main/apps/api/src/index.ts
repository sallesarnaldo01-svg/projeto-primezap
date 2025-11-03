import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { connectDatabase } from './lib/prisma.js';
import { redis } from './lib/redis.js';
import { initializeSocket } from './lib/socket.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes';
import flowsRoutes from './routes/flows.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import integrationsRoutes from './routes/integrations.routes';
import authLoginRoute from './routes/auth.login';

const app = express();
const httpServer = createServer(app);

// Middleware
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
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, origin);
    }
    logger.warn({ origin }, 'Blocked by CORS');
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id'],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pinoHttp({ logger }));
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
import connectionsRoutes from './routes/connections.routes';
import queuesRoutes from './routes/queues.routes';
import broadcastsRoutes from './routes/broadcasts.routes';
import campaignsRoutes from './routes/campaigns.routes';
import scrumRoutes from './routes/scrum.routes';
import videoCallRoutes from './routes/video-call.routes';
import facebookRoutes from './routes/facebook.routes';
import instagramRoutes from './routes/instagram.routes';
import aiProvidersRoutes from './routes/ai-providers.routes';
import aiToolsRoutes from './routes/ai-tools.routes';
import knowledgeRoutes from './routes/knowledge.routes';
import productsRoutes from './routes/products.routes';
import mediaRoutes from './routes/media.routes';
import followupCadenceRoutes from './routes/followup-cadence.routes';
import customFieldsRoutes from './routes/custom-fields.routes';
import aiUsageRoutes from './routes/ai-usage.routes';
import leadsRoutes from './routes/leads.routes';
import conversationEventsRoutes from './routes/conversation-events.routes';
import dashboardRoutes from './routes/dashboard.routes';
import crmRoutes from './routes/crm.routes';
import dealsRoutes from './routes/deals.routes';
import contactsRoutes from './routes/contacts.routes';
import ticketsRoutes from './routes/tickets.routes';
import usersRoutes from './routes/users.routes';
import reportsRoutes from './routes/reports.routes';
import messagesRoutes from './routes/messages.routes';
import tagsRoutes from './routes/tags.routes';
import contactListsRoutes from './routes/contact-lists.routes';
import companiesRoutes from './routes/companies.routes';
import notificationsRoutes from './routes/notifications.routes';
import appointmentsRoutes from './routes/appointments.routes';
import reportsCrmRoutes from './routes/reports-crm.routes';
import preCadastrosRoutes from './routes/pre-cadastros.routes';
import correspondentesRoutes from './routes/correspondentes.routes';
import empreendimentosRoutes from './routes/empreendimentos.routes';
import simulacoesRoutes from './routes/simulacoes.routes';
import leadInteractionsRoutes from './routes/lead-interactions.routes';
import documentosRoutes from './routes/documentos.routes';
import leadEnhancementsRoutes from './routes/lead-enhancements.routes';
import leadActionsRoutes from './routes/lead-actions.routes';
import dealInteractionsRoutes from './routes/deal-interactions.routes';
import notificationsRoutes from './routes/notifications.routes';

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
// properties/visits routes not present in this build; removing to stabilize boot
app.use('/api/media', mediaRoutes);
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
app.use('/api/notifications', notificationsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/reports/crm', reportsCrmRoutes);
// internal-chat routes are not present in this build; disabled to prevent boot failure
// message-templates routes not present in this build
app.use('/api/pre-cadastros', preCadastrosRoutes);
app.use('/api/correspondentes', correspondentesRoutes);
app.use('/api/empreendimentos', empreendimentosRoutes);
app.use('/simulacoes', simulacoesRoutes);
app.use('/api/lead-interactions', leadInteractionsRoutes);
app.use('/api/documentos', documentosRoutes);
app.use('/api/leads', leadEnhancementsRoutes);
app.use('/api/lead-actions', leadActionsRoutes);
app.use('/api/deal-interactions', dealInteractionsRoutes);
app.use('/api/notifications', notificationsRoutes);

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
    await connectDatabase();
    await redis.ping();
    initializeSocket(httpServer);

    httpServer.listen(env.PORT, () => {
      logger.info(`🚀 API Server running on port ${env.PORT}`);
      logger.info(`📝 Environment: ${env.NODE_ENV}`);
      logger.info(`🌐 CORS enabled for: ${env.FRONTEND_ORIGIN}`);
    });
  } catch (error) {
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
