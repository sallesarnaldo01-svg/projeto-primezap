import { Router, Request, Response } from 'express';
import { sendEmail } from '../services/email.service';

const router = Router();

/**
 * @route POST /api/email/test
 * @description Rota de teste para envio de email.
 * @access Public (Apenas para teste inicial)
 */
router.post('/test', async (req: Request, res: Response) => {
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ message: 'Missing required fields: to, subject, html' });
  }

  try {
    const info = await sendEmail(to, subject, html);
    res.status(200).json({ message: 'Email sent successfully', info });
  } catch (error) {
    res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
});

export default router;
