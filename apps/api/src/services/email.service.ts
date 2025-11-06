/**
 * Serviço de Email usando Nodemailer
 * Suporta SMTP configurável via variáveis de ambiente
 */

import nodemailer from 'nodemailer';
import { logger } from '../lib/logger';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer | string;
  }>;
}

function normalizeRecipients(value?: string | string[]) {
  if (!value) {
    return undefined;
  }

  return Array.isArray(value) ? value.join(', ') : value;
}

/**
 * Cria transporter do Nodemailer com configuração do ambiente
 */
function createTransporter() {
  const config = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
    },
  };

  if (!config.auth.user || !config.auth.pass) {
    logger.warn('SMTP credentials not configured. Email service will not work.');
    return null;
  }

  return nodemailer.createTransport(config);
}

/**
 * Envia um email com opções completas
 * @param options Opções do email (to, subject, html, text, etc.)
 * @returns Resultado do envio com messageId
 */
export async function sendEmail(options: EmailOptions | { to: string; subject: string; html: string }) {
  const transporter = createTransporter();

  if (!transporter) {
    logger.error('Email transporter not configured. Check SMTP_USER and SMTP_PASS environment variables.');
    throw new Error('Email service not configured');
  }

  try {
    // Suportar assinatura antiga (to, subject, html)
    const mailOptions = 'to' in options && 'subject' in options && 'html' in options && Object.keys(options).length === 3
      ? {
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: options.to,
          subject: options.subject,
          html: options.html,
        }
      : {
          from: (options as EmailOptions).from || process.env.SMTP_FROM || process.env.SMTP_USER,
          to: normalizeRecipients((options as EmailOptions).to) || (options as EmailOptions).to,
          subject: (options as EmailOptions).subject,
          html: (options as EmailOptions).html,
          text: (options as EmailOptions).text,
          cc: normalizeRecipients((options as EmailOptions).cc),
          bcc: normalizeRecipients((options as EmailOptions).bcc),
          attachments: (options as EmailOptions).attachments,
        };

    logger.info({ to: mailOptions.to, subject: mailOptions.subject }, 'Sending email');

    const info = await transporter.sendMail(mailOptions);

    logger.info({ messageId: info.messageId, to: mailOptions.to }, 'Email sent successfully');

    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    };
  } catch (error) {
    logger.error({ error, to: (options as EmailOptions).to, subject: (options as EmailOptions).subject }, 'Failed to send email');
    throw error;
  }
}

/**
 * Envia email de boas-vindas
 */
export async function sendWelcomeEmail(to: string, name: string) {
  return sendEmail({
    to,
    subject: 'Bem-vindo ao PrimeZap AI',
    html: `
      <h1>Olá, ${name}!</h1>
      <p>Seja bem-vindo ao PrimeZap AI, sua plataforma de CRM e automação de WhatsApp.</p>
      <p>Estamos felizes em tê-lo conosco!</p>
      <p>Atenciosamente,<br>Equipe PrimeZap</p>
    `,
  });
}

/**
 * Envia email de recuperação de senha
 */
export async function sendPasswordResetEmail(to: string, resetToken: string) {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  return sendEmail({
    to,
    subject: 'Recuperação de Senha - PrimeZap AI',
    html: `
      <h1>Recuperação de Senha</h1>
      <p>Você solicitou a recuperação de senha da sua conta PrimeZap AI.</p>
      <p>Clique no link abaixo para redefinir sua senha:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>Este link expira em 1 hora.</p>
      <p>Se você não solicitou esta recuperação, ignore este email.</p>
      <p>Atenciosamente,<br>Equipe PrimeZap</p>
    `,
  });
}

/**
 * Envia email de notificação de lead
 */
export async function sendLeadNotificationEmail(to: string, leadName: string, leadEmail: string, leadPhone: string) {
  return sendEmail({
    to,
    subject: `Novo Lead: ${leadName}`,
    html: `
      <h1>Novo Lead Recebido</h1>
      <p>Um novo lead foi cadastrado no sistema:</p>
      <ul>
        <li><strong>Nome:</strong> ${leadName}</li>
        <li><strong>Email:</strong> ${leadEmail}</li>
        <li><strong>Telefone:</strong> ${leadPhone}</li>
      </ul>
      <p>Acesse o sistema para mais detalhes.</p>
      <p>Atenciosamente,<br>PrimeZap AI</p>
    `,
  });
}

/**
 * Verifica se o serviço de email está configurado
 */
export function isEmailConfigured(): boolean {
  return !!(process.env.SMTP_USER && (process.env.SMTP_PASS || process.env.SMTP_PASSWORD));
}
