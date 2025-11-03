import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { correspondentesController } from '../controllers/correspondentes.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', correspondentesController.list);
router.post('/', correspondentesController.create);
router.delete('/:id', correspondentesController.remove);
router.get('/:id/users', correspondentesController.listUsers);
router.post('/:id/users', correspondentesController.createUser);
router.delete('/users/:userId', correspondentesController.removeUser);

export default router;
