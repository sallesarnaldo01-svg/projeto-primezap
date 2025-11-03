import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/dashboard/metrics - Métricas principais
router.get('/metrics', dashboardController.getMetrics);

// GET /api/dashboard/funnel - Funil de vendas
router.get('/funnel', dashboardController.getFunnel);

// GET /api/dashboard/tickets-by-status - Tickets por status
router.get('/tickets-by-status', dashboardController.getTicketsByStatus);

// GET /api/dashboard/recent-activity - Atividades recentes
router.get('/recent-activity', dashboardController.getRecentActivity);

// GET /api/dashboard/performance - Performance da equipe
router.get('/performance', dashboardController.getPerformance);

export default router;

