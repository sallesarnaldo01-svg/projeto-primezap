import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { empreendimentosController } from '../controllers/empreendimentos.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', empreendimentosController.list);

export default router;
