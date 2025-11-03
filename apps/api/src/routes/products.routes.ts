import { Router } from 'express';
import { productsController } from '../controllers/products.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', productsController.list);
router.get('/categories', productsController.getCategories);
router.get('/tags', productsController.getTags);
router.post('/search/by-tags', productsController.searchByTags);
router.post('/bulk-import', productsController.bulkImport);
router.get('/:id', productsController.getById);
router.post('/', productsController.create);
router.put('/:id', productsController.update);
router.patch('/:id/stock', productsController.updateStock);
router.delete('/:id', productsController.delete);

export default router;
