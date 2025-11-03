import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as reportsController from '../controllers/reports.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/reports/sales - Relatório de vendas
router.get('/sales', reportsController.getSalesReport);

// GET /api/reports/performance - Relatório de performance
router.get('/performance', reportsController.getPerformanceReport);

// GET /api/reports/conversations - Relatório de conversas
router.get('/conversations', reportsController.getConversationsReport);

// GET /api/reports/campaigns - Relatório de campanhas
router.get('/campaigns', reportsController.getCampaignsReport);

// GET /api/reports/export - Exporta relatório em CSV
router.get('/export', reportsController.exportReport);

export default router;

