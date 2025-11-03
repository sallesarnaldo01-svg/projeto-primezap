import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { empreendimentosController } from '../controllers/empreendimentos.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', empreendimentosController.list);
router.post('/', empreendimentosController.create);
router.put('/:id', empreendimentosController.update);
router.delete('/:id', empreendimentosController.remove);

export default router;
