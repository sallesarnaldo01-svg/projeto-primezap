import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { simulacoesController } from '../controllers/simulacoes.controller.js';

const router = Router();
router.use(authenticate);

router.post('/calcular', simulacoesController.calcular);
router.post('/', simulacoesController.create);
router.get('/', simulacoesController.list);
router.get('/:id', simulacoesController.getById);
router.get('/:id/pdf', simulacoesController.pdf);

export default router;
