import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as crmController from '../controllers/crm.controller.js';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/crm/deals - Lista todos os deals
router.get('/deals', crmController.getDeals);

// POST /api/crm/deals - Cria um novo deal
router.post('/deals', crmController.createDeal);

// PUT /api/crm/deals/:id - Atualiza um deal
router.put('/deals/:id', crmController.updateDeal);

// PUT /api/crm/deals/:id/stage - Move deal para outro estágio
router.put('/deals/:id/stage', crmController.updateDealStage);

// DELETE /api/crm/deals/:id - Deleta um deal
router.delete('/deals/:id', crmController.deleteDeal);

// GET /api/crm/pipeline - Visão do pipeline
router.get('/pipeline', crmController.getPipeline);

export default router;

