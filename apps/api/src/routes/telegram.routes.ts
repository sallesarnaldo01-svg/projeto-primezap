import { Router, Request, Response } from 'express';
import { sendTelegramMessage, setTelegramWebhook } from '../services/telegram.service';

const router = Router();

/**
 * @route POST /api/telegram/webhook
 * @description Endpoint para o Telegram enviar atualizações (mensagens, etc.).
 * @access Public (Usado pelo Telegram)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const update = req.body;
  // Lógica para processar a atualização (ex: salvar mensagem no DB, iniciar workflow)
  console.log('Received Telegram update:', update);

  // Responde imediatamente para evitar reenvio
  res.sendStatus(200);
});

/**
 * @route POST /api/telegram/send
 * @description Envia uma mensagem para um chat específico.
 * @access Private (Deve ser protegido por autenticação)
 */
router.post('/send', async (req: Request, res: Response) => {
  const { chatId, message } = req.body;

  if (!chatId || !message) {
    return res.status(400).json({ message: 'Missing required fields: chatId, message' });
  }

  try {
    const sentMessage = await sendTelegramMessage(chatId, message);
    res.status(200).json({ message: 'Telegram message sent successfully', sentMessage });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send Telegram message', error: error.message });
  }
});

/**
 * @route POST /api/telegram/set-webhook
 * @description Configura o webhook no Telegram.
 * @access Private (Deve ser protegido por autenticação)
 */
router.post('/set-webhook', async (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ message: 'Missing required field: url' });
  }

  try {
    const success = await setTelegramWebhook(url);
    res.status(200).json({ message: 'Telegram webhook set successfully', success });
  } catch (error) {
    res.status(500).json({ message: 'Failed to set Telegram webhook', error: error.message });
  }
});

export default router;
