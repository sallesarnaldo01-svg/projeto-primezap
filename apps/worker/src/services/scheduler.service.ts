import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getWhatsAppProvider } from '../providers/whatsapp/index.js';

const CAMPAIGN_QUEUE_KEY = 'scheduled_campaigns_queue';
const APPOINTMENT_QUEUE_KEY = 'appointment_reminders_queue';
const APPOINTMENT_FEEDBACK_QUEUE_KEY = 'appointment_feedback_queue';

const CAMPAIGN_POLL_INTERVAL_MS = 5000;
const APPOINTMENT_POLL_INTERVAL_MS = 5000;
const APPOINTMENT_FEEDBACK_POLL_INTERVAL_MS = 5000;

type ScheduledMessage = {
  type?: 'text' | 'image' | 'audio' | 'video' | 'document';
  content?: string;
  mediaUrl?: string;
  delayAfter?: number;
};

type ScheduleArray = string[] | null | unknown;
type MessageArray = ScheduledMessage[] | null | unknown;

export function startScheduledCampaignMonitor() {
  const poll = async () => {
    try {
      const now = Date.now();
      const campaignIds = await redis.zrangebyscore(CAMPAIGN_QUEUE_KEY, 0, now);

      if (!campaignIds.length) {
        return;
      }

      for (const campaignId of campaignIds) {
        await redis.zrem(CAMPAIGN_QUEUE_KEY, campaignId);
        await processScheduledCampaign(campaignId);
      }
    } catch (error) {
      logger.error({ err: error }, 'Scheduled campaign monitor error');
    }
  };

  setInterval(poll, CAMPAIGN_POLL_INTERVAL_MS);
}

export function startAppointmentReminderMonitor() {
  const poll = async () => {
    try {
      const now = Date.now();
      const reminderIds = await redis.zrangebyscore(APPOINTMENT_QUEUE_KEY, 0, now);

      if (!reminderIds.length) {
        return;
      }

      for (const appointmentId of reminderIds) {
        await redis.zrem(APPOINTMENT_QUEUE_KEY, appointmentId);
        await processAppointmentReminder(appointmentId);
      }
    } catch (error) {
      logger.error({ err: error }, 'Appointment reminder monitor error');
    }
  };

  setInterval(poll, APPOINTMENT_POLL_INTERVAL_MS);
}

export function startAppointmentFeedbackMonitor() {
  const poll = async () => {
    try {
      const now = Date.now();
      const ids = await redis.zrangebyscore(APPOINTMENT_FEEDBACK_QUEUE_KEY, 0, now);
      if (!ids.length) return;
      for (const appointmentId of ids) {
        await redis.zrem(APPOINTMENT_FEEDBACK_QUEUE_KEY, appointmentId);
        await processAppointmentFeedback(appointmentId);
      }
    } catch (error) {
      logger.error({ err: error }, 'Appointment feedback monitor error');
    }
  };

  setInterval(poll, APPOINTMENT_FEEDBACK_POLL_INTERVAL_MS);
}

async function processScheduledCampaign(campaignId: string) {
  const campaign = await prisma.scheduled_campaigns.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) {
    logger.warn({ campaignId }, 'Scheduled campaign not found');
    return;
  }

  if (campaign.status === 'cancelled') {
    logger.info({ campaignId }, 'Skipping cancelled scheduled campaign');
    return;
  }

  if (campaign.status === 'paused') {
    logger.info({ campaignId }, 'Skipping paused scheduled campaign');
    return;
  }

  if (campaign.status !== 'scheduled') {
    logger.debug({ campaignId, status: campaign.status }, 'Scheduled campaign not in scheduled state');
    return;
  }

  await prisma.scheduled_campaigns.update({
    where: { id: campaignId },
    data: {
      status: 'running',
      updatedAt: new Date(),
    },
  });

  const contacts = parseContacts(campaign.contacts);
  const messages = parseMessages((campaign as any).messagesPayload ?? (campaign as any).messages_payload);
  let sent = 0;
  let failed = 0;

  for (const contact of contacts) {
    try {
      await sendMessagesToContact(contact, messages);
      sent += 1;
    } catch (error) {
      failed += 1;
      logger.error({ campaignId, contact, err: error }, 'Failed to send scheduled campaign contact');
    }

    await prisma.scheduled_campaigns.update({
      where: { id: campaignId },
      data: {
        stats: {
          sent,
          failed,
          total: contacts.length,
        },
        updatedAt: new Date(),
      },
    });

    const delay = (campaign as any).delaySeconds ?? (campaign as any).delay_seconds ?? 0;
    if (delay && delay > 0) {
      await sleep(delay * 1000);
    }
  }

  const finalStatus = failed === contacts.length ? 'failed' : 'completed';

  await prisma.scheduled_campaigns.update({
    where: { id: campaignId },
    data: {
      status: finalStatus,
      stats: {
        sent,
        failed,
        total: contacts.length,
      },
      updatedAt: new Date(),
    },
  });

  logger.info({ campaignId, sent, failed }, 'Scheduled campaign finished');
}

async function processAppointmentReminder(appointmentId: string) {
  // read appointment and resolve contact phone
  const rows = await prisma.$queryRawUnsafe(
    `SELECT a.*, c.phone AS phone
     FROM public.appointments a
     LEFT JOIN public.contacts c ON c.id = a.contact_id
     WHERE a.id = $1
     LIMIT 1`,
    appointmentId,
  );
  const appointment = rows[0];
  if (!appointment) { logger.warn({ appointmentId }, 'Appointment not found for reminder'); return; }
  if (appointment.reminder_sent) { logger.debug({ appointmentId }, 'Appointment reminder already sent'); return; }

  // try to send WhatsApp reminder if we can resolve a default connection
  try {
    const connRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.whatsapp_connections WHERE tenant_id = $1 AND status = 'CONNECTED' ORDER BY updated_at DESC LIMIT 1`,
      appointment.tenant_id,
    );
    const connectionId = connRows[0]?.id;
    const phone = String(appointment.phone || '').trim();
    if (connectionId && phone) {
      const provider = getWhatsAppProvider();
      const dateStr = appointment.start_at ? new Date(appointment.start_at).toLocaleString('pt-BR') : '';
      const content = { text: `Lembrete: você tem um atendimento agendado em ${dateStr}.\n\nResponda com:\n1 - Confirmar\n2 - Remarcar\n3 - Cancelar` };
      await provider.sendMessage({ connectionId, to: phone, content });
      logger.info({ appointmentId, connectionId, phone }, 'WhatsApp reminder sent');
    } else {
      logger.warn({ appointmentId, hasConnection: Boolean(connectionId), phone }, 'Could not resolve WhatsApp connection/phone');
    }
  } catch (err) {
    logger.error({ appointmentId, err }, 'Failed to send WhatsApp reminder');
  }

  // mark as sent regardless to avoid loops; rely on logs for fail investigation
  await prisma.$executeRawUnsafe(`UPDATE public.appointments SET reminder_sent = true, updated_at = now() WHERE id = $1`, appointmentId);
  logger.info({ appointmentId }, 'Appointment reminder processed');
}

async function processAppointmentFeedback(appointmentId: string) {
  // read appointment and resolve contact phone
  const rows = await prisma.$queryRawUnsafe(
    `SELECT a.*, c.phone AS phone
     FROM public.appointments a
     LEFT JOIN public.contacts c ON c.id = a.contact_id
     WHERE a.id = $1
     LIMIT 1`,
    appointmentId,
  );
  const appointment = rows[0];
  if (!appointment) { logger.warn({ appointmentId }, 'Appointment not found for feedback'); return; }

  try {
    const connRows = await prisma.$queryRawUnsafe(
      `SELECT id FROM public.whatsapp_connections WHERE tenant_id = $1 AND status = 'CONNECTED' ORDER BY updated_at DESC LIMIT 1`,
      appointment.tenant_id,
    );
    const connectionId = connRows[0]?.id;
    const phone = String(appointment.phone || '').trim();
    if (connectionId && phone) {
      const provider = getWhatsAppProvider();
      const content = { text: 'Obrigado pela visita! De 1 a 5, como você avalia sua experiência? (Responda com um número de 1 a 5 e, se quiser, um comentário.)' };
      await provider.sendMessage({ connectionId, to: phone, content });
      logger.info({ appointmentId, connectionId, phone }, 'WhatsApp feedback request sent');
    } else {
      logger.warn({ appointmentId, hasConnection: Boolean(connectionId), phone }, 'Could not resolve WhatsApp connection/phone for feedback');
    }
  } catch (err) {
    logger.error({ appointmentId, err }, 'Failed to send WhatsApp feedback request');
  }
}

export async function scheduleAppointmentFeedback(appointmentId: string, scheduledAt: Date | null, durationMinutes: number | null, offsetMinutes: number = 15) {
  if (!scheduledAt) return;
  const duration = typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60;
  const sendAt = new Date(scheduledAt.getTime() + duration * 60000 + offsetMinutes * 60000);
  if (sendAt.getTime() <= Date.now()) return;
  await redis.zadd(APPOINTMENT_FEEDBACK_QUEUE_KEY, sendAt.getTime(), appointmentId);
}

function parseContacts(raw: ScheduleArray): string[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value)).filter(Boolean);
  }
  return [];
}

function parseMessages(raw: MessageArray): ScheduledMessage[] {
  if (Array.isArray(raw)) {
    return raw.map((value) => {
      if (typeof value !== 'object' || value === null) {
        return {};
      }
      const typed = value as Record<string, unknown>;
      return {
        type: (typeof typed.type === 'string' ? typed.type : 'text') as ScheduledMessage['type'],
        content: typeof typed.content === 'string' ? typed.content : '',
        mediaUrl: typeof typed.mediaUrl === 'string' ? typed.mediaUrl : undefined,
        delayAfter: typeof typed.delayAfter === 'number' ? typed.delayAfter : undefined,
      };
    });
  }
  return [];
}

async function sendMessagesToContact(contact: string, messages: ScheduledMessage[]) {
  for (const message of messages) {
    logger.info({ contact, message }, 'Simulating scheduled campaign message');

    if (message.delayAfter && message.delayAfter > 0) {
      await sleep(message.delayAfter * 1000);
    }
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
