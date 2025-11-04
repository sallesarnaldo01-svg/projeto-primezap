import { Router, Request, Response } from 'express';
import { sendSms } from '../services/sms.service';

const router = Router();

/**
 * @route POST /api/sms/send
 * @description Envia uma mensagem SMS.
 * @access Private (Deve ser protegido por autenticação)
 */
router.post('/send', async (req: Request, res: Response) => {
  const { to, body } = req.body;

  if (!to || !body) {
    return res.status(400).json({ message: 'Missing required fields: to, body' });
  }

  try {
    const message = await sendSms(to, body);
    res.status(200).json({ message: 'SMS sent successfully', sid: message.sid });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send SMS', error: error.message });
  }
});

/**
 * @route POST /api/sms/webhook
 * @description Endpoint para o Twilio enviar status de entrega (opcional).
 * @access Public (Usado pelo Twilio)
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const statusUpdate = req.body;
  // Lógica para processar o status de entrega (ex: atualizar DB)
  console.log('Received SMS status update:', statusUpdate);

  res.sendStatus(200);
});

export default router;
