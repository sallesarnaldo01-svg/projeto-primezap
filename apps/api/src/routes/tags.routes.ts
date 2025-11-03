import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import * as tagsController from '../controllers/tags.controller.js';

const router = Router();

router.use(authenticate);

router.get('/', tagsController.listTags);
router.get('/search', tagsController.searchTags);
router.get('/popular', tagsController.getPopularTags);
router.get('/usage-stats', tagsController.getUsageStats);

router.get('/categories', tagsController.getCategories);
router.post('/categories', tagsController.createCategory);
router.put('/categories/:id', tagsController.updateCategory);
router.delete('/categories/:id', tagsController.deleteCategory);

router.post('/merge', tagsController.mergeTags);
router.post('/bulk-operation', tagsController.bulkOperation);

router.post('/', tagsController.createTag);
router.get('/:id', tagsController.getTag);
router.put('/:id', tagsController.updateTag);
router.delete('/:id', tagsController.deleteTag);

export default router;
