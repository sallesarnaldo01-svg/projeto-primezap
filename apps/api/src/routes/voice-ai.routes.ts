import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { processCallAudio } from '../services/voice-ai.service';
import multer from 'multer';

const router = Router();
// Configuração básica do Multer para upload de arquivos (salva em memória ou temporário)
const upload = multer({ dest: 'uploads/' });

router.use(authenticate);

/**
 * @route POST /api/voice-ai/process-call
 * @description Recebe um arquivo de áudio, transcreve e analisa.
 * @access Private
 */
router.post('/process-call', upload.single('audioFile'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Missing audio file in request.' });
  }

  try {
    // O caminho do arquivo temporário é req.file.path
    const result = await processCallAudio(req.file.path);

    // Limpar o arquivo temporário após o processamento (A ser implementado na lógica real)
    // fs.unlinkSync(req.file.path);

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Failed to process audio file', error: error.message });
  }
});

export default router;
