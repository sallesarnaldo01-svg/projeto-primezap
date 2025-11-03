import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { documentosController } from '../controllers/documentos.controller.js';

const router = Router();
router.use(authenticate);

router.get('/tipos', documentosController.listTipos);
router.post('/tipos', documentosController.createTipo);
router.delete('/tipos/:id', documentosController.deleteTipo);

router.get('/', documentosController.list);
router.post('/upload-url', documentosController.uploadUrl);
router.post('/commit', documentosController.commit);
router.post('/:id/approve', documentosController.approve);
router.post('/:id/reject', documentosController.reject);
router.get('/download-zip', documentosController.downloadZip);
router.get('/download-pdf', documentosController.downloadPdf);

export default router;
