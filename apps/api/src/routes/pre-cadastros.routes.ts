import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { preCadastrosController } from '../controllers/pre-cadastros.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', preCadastrosController.list);
router.get('/:id', preCadastrosController.getById);
router.post('/', preCadastrosController.create);
router.post('/:id/assign-correspondente', preCadastrosController.assignCorrespondente);

export default router;
