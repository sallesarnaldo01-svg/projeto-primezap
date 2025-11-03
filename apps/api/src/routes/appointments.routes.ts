import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { appointmentsController } from '../controllers/appointments.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', appointmentsController.list);
router.get('/:appointmentId', appointmentsController.get);
router.post('/', appointmentsController.create);
router.put('/:appointmentId', appointmentsController.update);
router.post('/:appointmentId/confirm', appointmentsController.confirm);
router.post('/:appointmentId/cancel', appointmentsController.cancel);
router.delete('/:appointmentId', appointmentsController.remove);

export default router;
