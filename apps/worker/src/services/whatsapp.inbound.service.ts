import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getWhatsAppProvider, listWhatsAppProviders } from '../providers/whatsapp/index.js';

type InboundPayload = {
  connectionId: string;
  from: string;
  content: {
    text?: string;
    image?: { url: string; caption?: string };
    audio?: { url: string; ptt?: boolean };
    video?: { url: string; caption?: string };
    document?: { url: string; filename?: string };
  };
  timestamp: Date;
  tenantId?: string;
  sessionName?: string;
};

export function registerWhatsAppInboundHandlers() {
  try {
    for (const key of listWhatsAppProviders()) {
      const provider = getWhatsAppProvider(key);
      provider.onMessage(async (payload: InboundPayload) => {
        try {
          await handleIncomingWhatsAppMessage(payload);
        } catch (error) {
          logger.error({ error, payloadMeta: { connectionId: payload.connectionId, from: payload.from } }, 'Failed to handle incoming WhatsApp message');
        }
      });
    }
    logger.info('📥 WhatsApp inbound handlers registered');
  } catch (error) {
    logger.error({ error }, 'Failed to register WhatsApp inbound handlers');
  }
}

async function handleIncomingWhatsAppMessage(payload: InboundPayload) {
  // Ignore obvious group chats
  if (payload.from?.endsWith('@g.us')) return;

  // Resolve connection and tenant
  const connection = await prisma.connections.findUnique({ where: { id: payload.connectionId } });
  if (!connection) {
    logger.warn({ connectionId: payload.connectionId }, 'Inbound message for unknown connection');
    return;
  }

  const tenantId = payload.tenantId ?? connection.tenantId;

  // Resolve contact
  const phoneDigits = normalizePhone(extractPhoneFromAddress(payload.from));
  if (!phoneDigits) {
    logger.warn({ from: payload.from }, 'Could not resolve phone digits from WhatsApp address');
    return;
  }

  const contact = await upsertContact(tenantId, phoneDigits);

  // Resolve default user for the tenant (owner of the conversation)
  const userId = await resolveDefaultUserId(tenantId);
  if (!userId) {
    logger.warn({ tenantId }, 'No active user found to own conversation; skipping message persist');
    return;
  }

  // Resolve or create conversation
  const conversation = await getOrCreateConversation(userId, contact.id);

  // Persist message
  const messageRecord = await createInboundMessage(conversation.id, contact.id, payload);

  // Update conversation summary/counters
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: messageRecord.createdAt ?? new Date(),
      lastMessageFrom: 'contact',
      lastMessageContent: payload.content.text ?? inferMediaLabel(payload),
      messageCount: (conversation.messageCount ?? 0) + 1,
      unreadCount: (conversation.unreadCount ?? 0) + 1,
      updatedAt: new Date(),
    },
  }).catch(() => undefined);

  // Try simple appointment flows (confirm/cancel/reagendar and feedback rating)
  if (payload.content.text) {
    await tryHandleAppointmentFlow(tenantId, userId, contact.id, payload.content.text, payload.timestamp).catch(() => undefined);
  }
}

async function upsertContact(tenantId: string, phone: string) {
  // Try by tenant+phone
  const found = await prisma.contacts.findFirst({ where: { tenantId, phone } });
  if (found) return found;

  return prisma.contacts.create({
    data: {
      tenantId,
      name: phone,
      phone,
      origin: 'whatsapp',
      whatsappId: phone,
    },
  });
}

async function getOrCreateConversation(userId: string, contactId: string) {
  const existing = await prisma.conversation.findFirst({
    where: { userId, contactId },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      userId,
      contactId,
      status: 'active',
      messageCount: 0,
      unreadCount: 0,
      metadata: {},
    },
  });
}

async function createInboundMessage(conversationId: string, contactId: string, payload: InboundPayload) {
  const base = {
    conversationId,
    sender: 'contact',
    senderId: contactId,
    status: 'received' as const,
    createdAt: payload.timestamp ?? new Date(),
    metadata: {},
  };

  if (payload.content.text) {
    return prisma.message.create({ data: { ...base, type: 'text', content: payload.content.text } });
  }
  if (payload.content.image) {
    return prisma.message.create({
      data: {
        ...base,
        type: 'image',
        mediaUrl: payload.content.image.url,
        content: payload.content.image.caption ?? null,
        mediaType: 'image',
      },
    });
  }
  if (payload.content.audio) {
    return prisma.message.create({
      data: {
        ...base,
        type: 'audio',
        mediaUrl: payload.content.audio.url,
        mediaType: payload.content.audio.ptt ? 'audio/ptt' : 'audio',
      },
    });
  }
  if (payload.content.video) {
    return prisma.message.create({
      data: {
        ...base,
        type: 'video',
        mediaUrl: payload.content.video.url,
        content: payload.content.video.caption ?? null,
        mediaType: 'video',
      },
    });
  }
  if (payload.content.document) {
    return prisma.message.create({
      data: {
        ...base,
        type: 'document',
        mediaUrl: payload.content.document.url,
        mediaType: 'application/octet-stream',
        content: payload.content.document.filename ?? null,
      },
    });
  }

  // Fallback
  return prisma.message.create({ data: { ...base, type: 'text', content: '' } });
}

function inferMediaLabel(payload: InboundPayload): string {
  if (payload.content.image) return '[imagem]';
  if (payload.content.audio) return '[áudio]';
  if (payload.content.video) return '[vídeo]';
  if (payload.content.document) return '[documento]';
  return '';
}

function extractPhoneFromAddress(address: string): string {
  // Baileys: 559999999999@s.whatsapp.net | Venom: 559999999999@c.us
  return (address || '').split('@')[0] || '';
}

function normalizePhone(input: string): string {
  return String(input || '').replace(/\D/g, '');
}

async function resolveDefaultUserId(tenantId: string): Promise<string | null> {
  const admin = await prisma.public_users.findFirst({ where: { tenantId, role: 'admin', isActive: true } });
  if (admin) return admin.id;
  const any = await prisma.public_users.findFirst({ where: { tenantId, isActive: true } });
  return any?.id ?? null;
}

async function tryHandleAppointmentFlow(
  tenantId: string,
  userId: string,
  contactId: string,
  text: string,
  at: Date,
) {
  const cleaned = (text || '').trim().toLowerCase();

  // Confirmation intent
  if (/(^|\b)(1|confirm|confirmar|sim|ok)(\b|$)/.test(cleaned)) {
    const appt = await findUpcomingAppointment(userId, contactId, at);
    if (appt) {
      await prisma.appointments.update({ where: { id: appt.id }, data: { status: 'confirmed', updated_at: new Date() } });
      await createConversationEvent(tenantId, userId, contactId, 'appointment_confirmed', 'Confirmação de agendamento', `Agendamento ${appt.title} confirmado.`);
    }
    return;
  }

  // Reschedule intent
  if (/(^|\b)(2|reagendar|remarcar)(\b|$)/.test(cleaned)) {
    const appt = await findUpcomingAppointment(userId, contactId, at);
    if (appt) {
      await prisma.appointments.update({ where: { id: appt.id }, data: { status: 'pending', updated_at: new Date() } });
      await createConversationEvent(tenantId, userId, contactId, 'appointment_reschedule_requested', 'Solicitada remarcação', `Cliente pediu remarcação do agendamento ${appt.title}.`);
    }
    return;
  }

  // Cancel intent
  if (/(^|\b)(3|cancelar|cancel)(\b|$)/.test(cleaned)) {
    const appt = await findUpcomingAppointment(userId, contactId, at);
    if (appt) {
      await prisma.appointments.update({ where: { id: appt.id }, data: { status: 'cancelled', updated_at: new Date() } });
      await createConversationEvent(tenantId, userId, contactId, 'appointment_cancelled_by_contact', 'Cancelamento solicitado', `Cliente cancelou agendamento ${appt.title}.`);
    }
    return;
  }

  // Feedback rating 1-5
  const m = cleaned.match(/\b([1-5])\b/);
  if (m) {
    const rating = Number(m[1]);
    const recent = await findRecentAppointment(userId, contactId, at);
    if (recent) {
      await createConversationEvent(
        tenantId,
        userId,
        contactId,
        'appointment_feedback',
        'Feedback de atendimento',
        `Avaliação recebida: ${rating}/5`,
        rating,
      );
    }
  }
}

async function findUpcomingAppointment(userId: string, contactId: string, now: Date) {
  const start = new Date(now.getTime());
  const end = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const items = await prisma.appointments.findMany({
    where: {
      user_id: userId,
      contact_id: contactId,
      status: { in: ['pending', 'scheduled'] as any },
      scheduled_at: { gte: start, lte: end } as any,
    },
    orderBy: { scheduled_at: 'asc' },
    take: 1,
  });
  return items[0] ?? null;
}

async function findRecentAppointment(userId: string, contactId: string, now: Date) {
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const items = await prisma.appointments.findMany({
    where: {
      user_id: userId,
      contact_id: contactId,
      scheduled_at: { gte: start, lte: now } as any,
    },
    orderBy: { scheduled_at: 'desc' },
    take: 1,
  });
  return items[0] ?? null;
}

async function createConversationEvent(
  tenantId: string,
  userId: string,
  contactId: string,
  eventType: string,
  title: string,
  description?: string,
  rating?: number,
) {
  // Find conversation to attach the event
  const convo = await prisma.conversation.findFirst({ where: { userId, contactId }, orderBy: { updatedAt: 'desc' } });
  if (!convo) return;

  await prisma.conversationEvent.create({
    data: {
      tenantId,
      conversationId: convo.id,
      eventType,
      actor: 'contact',
      actorName: 'Cliente',
      title,
      description,
      rating: typeof rating === 'number' ? rating : undefined,
      metadata: {},
    },
  }).catch(() => undefined);
}
