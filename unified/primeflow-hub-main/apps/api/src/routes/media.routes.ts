import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { mediaController, upload } from '../controllers/media.controller.js';

const router = Router();

router.use(authenticate);

router.post('/upload', upload.single('file'), mediaController.uploadSingle);
router.post('/upload-multiple', upload.array('files'), mediaController.uploadMultiple);
router.get('/', mediaController.list);
router.get('/tags', mediaController.getTags);
router.post('/search/by-tags', mediaController.searchByTags);
router.post('/:id/auto-tag', mediaController.autoTag);
router.get('/:id', mediaController.getById);
router.patch('/:id/tags', mediaController.updateTags);
router.delete('/:id', mediaController.delete);

export default router;
