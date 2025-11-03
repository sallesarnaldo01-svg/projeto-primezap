import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { reportsCrmController } from '../controllers/reports-crm.controller.js';

const router = Router();
router.use(authenticate);

router.get('/metrics', reportsCrmController.metrics);
router.get('/export/leads.csv', reportsCrmController.exportLeadsCsv);
router.get('/export/pre-cadastros.csv', reportsCrmController.exportPreCadastrosCsv);
router.get('/export/summary.pdf', reportsCrmController.exportSummaryPdf);

export default router;
