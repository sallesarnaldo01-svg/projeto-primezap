import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { leadsController } from '../controllers/leads.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', leadsController.list);
router.get('/export/csv', leadsController.export);
router.get('/:id', leadsController.getById);
router.post('/', leadsController.create);
router.put('/:id', leadsController.update);
router.patch('/:id/probability', leadsController.setProbability);
router.delete('/:id', leadsController.remove);
router.get('/:id/messages', leadsController.messages);
router.post('/distribute', leadsController.distribute);

export default router;
