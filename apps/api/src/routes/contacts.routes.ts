import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth.js';
import * as contactsController from '../controllers/contacts.controller.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Todas as rotas requerem autenticação
router.use(authenticate);

// GET /api/contacts - Lista todos os contatos
router.get('/', contactsController.getContacts);

// GET /api/contacts/stats - Estatísticas
router.get('/stats', contactsController.getStats);

// GET /api/contacts/:id/timeline - Timeline de atividades
router.get('/:id/timeline', contactsController.getTimeline);

// GET /api/contacts/:id - Busca um contato específico
router.get('/:id', contactsController.getContact);

// POST /api/contacts - Cria um novo contato
router.post('/', contactsController.createContact);

// PUT /api/contacts/:id - Atualiza um contato
router.put('/:id', contactsController.updateContact);

// DELETE /api/contacts/:id - Deleta um contato
router.delete('/:id', contactsController.deleteContact);

// POST /api/contacts/:id/tags - Adiciona tags a um contato
router.post('/:id/tags', contactsController.addTags);

// DELETE /api/contacts/:id/tags - Remove tags de um contato
router.delete('/:id/tags', contactsController.removeTags);

// POST /api/contacts/import - Importar CSV
router.post('/import', upload.single('file'), contactsController.importContacts);

export default router;
