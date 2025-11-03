import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const CAMPAIGN_QUEUE_KEY = 'scheduled_campaigns_queue';
const APPOINTMENT_QUEUE_KEY = 'appointment_reminders_queue';

const CAMPAIGN_POLL_INTERVAL_MS = 5000;
const APPOINTMENT_POLL_INTERVAL_MS = 5000;

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
      updated_at: new Date(),
    },
  });

  const contacts = parseContacts(campaign.contacts);
  const messages = parseMessages(campaign.messages_payload);
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
        updated_at: new Date(),
      },
    });

    if (campaign.delay_seconds && campaign.delay_seconds > 0) {
      await sleep(campaign.delay_seconds * 1000);
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
      updated_at: new Date(),
    },
  });

  logger.info({ campaignId, sent, failed }, 'Scheduled campaign finished');
}

async function processAppointmentReminder(appointmentId: string) {
  const appointment = await prisma.appointments.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    logger.warn({ appointmentId }, 'Appointment not found for reminder');
    return;
  }

  if (appointment.reminder_sent) {
    logger.debug({ appointmentId }, 'Appointment reminder already sent');
    return;
  }

  await prisma.appointments.update({
    where: { id: appointmentId },
    data: {
      reminder_sent: true,
      updated_at: new Date(),
    },
  });

  logger.info({ appointmentId }, 'Appointment reminder triggered');
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
