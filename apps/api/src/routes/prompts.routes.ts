import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { createPrompt, getPrompt, updatePrompt, listPrompts } from '../services/prompt.service';

const router = Router();

router.use(authenticate);

/**
 * @route GET /api/prompts
 * @description Lista todos os prompts de um tenant.
 * @access Private
 */
router.get('/', async (req: Request, res: Response) => {
  // Assumindo que o tenantId é extraído do token de autenticação
  const tenantId = req.headers['x-tenant-id'] as string;

  try {
    const prompts = await listPrompts(tenantId);
    res.status(200).json(prompts);
  } catch (error) {
    res.status(500).json({ message: 'Failed to list prompts', error: error.message });
  }
});

/**
 * @route POST /api/prompts
 * @description Cria um novo prompt.
 * @access Private
 */
router.post('/', async (req: Request, res: Response) => {
  const tenantId = req.headers['x-tenant-id'] as string;
  const { name, content, type } = req.body;

  if (!name || !content || !type) {
    return res.status(400).json({ message: 'Missing required fields: name, content, type' });
  }

  try {
    const newPrompt = await createPrompt({ name, content, type, tenantId });
    res.status(201).json(newPrompt);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create prompt', error: error.message });
  }
});

/**
 * @route GET /api/prompts/:id
 * @description Obtém um prompt específico.
 * @access Private
 */
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const prompt = await getPrompt(id);
    res.status(200).json(prompt);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get prompt', error: error.message });
  }
});

/**
 * @route PUT /api/prompts/:id
 * @description Atualiza um prompt existente.
 * @access Private
 */
router.put('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const updatedPrompt = await updatePrompt(id, updates);
    res.status(200).json(updatedPrompt);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update prompt', error: error.message });
  }
});

export default router;
