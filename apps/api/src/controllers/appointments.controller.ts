import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { emitToUser } from '../lib/socket.js';

const REMINDER_KEY = 'appointment_reminders_queue';
const FEEDBACK_KEY = 'appointment_feedback_queue';

export const appointmentsController = {
  async list(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { status, startDate, endDate, assignedTo, limit = 100, offset = 0 } = req.query;

    const where: Record<string, unknown> = { user_id: userId };

    if (status) where.status = status;
    if (assignedTo) where.assigned_to = assignedTo;

    if (startDate || endDate) {
      where.scheduled_at = {};
      if (startDate) (where.scheduled_at as Record<string, Date>).gte = new Date(String(startDate));
      if (endDate) (where.scheduled_at as Record<string, Date>).lte = new Date(String(endDate));
    }

    const [items, total] = await prisma.$transaction([
      prisma.appointments.findMany({
        where,
        orderBy: { scheduled_at: 'asc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.appointments.count({ where }),
    ]);

    res.json({
      data: items,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  },

  async get(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { appointmentId } = req.params;

    const appointment = await prisma.appointments.findFirst({
      where: { id: appointmentId, user_id: userId },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    res.json({ data: appointment });
  },

  async create(req: Request, res: Response) {
    const userId = req.user!.userId;
    const {
      contactId,
      title,
      description,
      scheduledAt,
      durationMinutes = 60,
      type = 'other',
      location,
      assignedTo,
      reminderMinutes = 30,
    } = req.body;

    if (!title || !scheduledAt) {
      return res.status(400).json({ error: 'Título e data agendada são obrigatórios' });
    }

    const appointment = await prisma.appointments.create({
      data: {
        user_id: userId,
        contact_id: contactId ?? null,
        title,
        description,
        scheduled_at: new Date(scheduledAt),
        duration_minutes: Number(durationMinutes),
        type,
        location,
        assigned_to: assignedTo ?? null,
        reminder_minutes: Number(reminderMinutes),
      },
    });

    await scheduleReminder(appointment.id, appointment.scheduled_at, appointment.reminder_minutes);
    await scheduleFeedback(appointment.id, appointment.scheduled_at, appointment.duration_minutes);
    emitToUser(userId, 'appointment:created', { appointmentId: appointment.id });

    res.status(201).json({
      message: 'Agendamento criado com sucesso',
      data: appointment,
    });
  },

  async update(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { appointmentId } = req.params;
    const updates = req.body as Record<string, unknown>;

    const existing = await prisma.appointments.findFirst({
      where: { id: appointmentId, user_id: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    const updated = await prisma.appointments.update({
      where: { id: appointmentId },
      data: {
        title: updates.title ?? existing.title,
        description: updates.description ?? existing.description,
        scheduled_at: updates.scheduledAt ? new Date(String(updates.scheduledAt)) : existing.scheduled_at,
        duration_minutes: updates.durationMinutes ?? existing.duration_minutes,
        type: updates.type ?? existing.type,
        status: updates.status ?? existing.status,
        location: updates.location ?? existing.location,
        assigned_to: updates.assignedTo ?? existing.assigned_to,
        reminder_minutes: updates.reminderMinutes ?? existing.reminder_minutes,
        reminder_sent: updates.reminderSent ?? existing.reminder_sent,
        updated_at: new Date(),
      },
    });

    if (updates.scheduledAt || updates.reminderMinutes) {
      await scheduleReminder(updated.id, updated.scheduled_at, updated.reminder_minutes);
    }
    if (updates.scheduledAt || updates.durationMinutes) {
      await scheduleFeedback(updated.id, updated.scheduled_at, updated.duration_minutes);
    }

    emitToUser(userId, 'appointment:updated', { appointmentId: appointmentId });

    res.json({ message: 'Agendamento atualizado', data: updated });
  },

  async confirm(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { appointmentId } = req.params;

    const appointment = await prisma.appointments.findFirst({
      where: { id: appointmentId, user_id: userId },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    const updated = await prisma.appointments.update({
      where: { id: appointmentId },
      data: { status: 'confirmed', updated_at: new Date() },
    });

    emitToUser(userId, 'appointment:confirmed', { appointmentId });

    res.json({ message: 'Agendamento confirmado', data: updated });
  },

  async cancel(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { appointmentId } = req.params;

    const appointment = await prisma.appointments.findFirst({
      where: { id: appointmentId, user_id: userId },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    const updated = await prisma.appointments.update({
      where: { id: appointmentId },
      data: { status: 'cancelled', updated_at: new Date() },
    });

    await redis.zrem(REMINDER_KEY, appointmentId);
    emitToUser(userId, 'appointment:cancelled', { appointmentId });

    res.json({ message: 'Agendamento cancelado', data: updated });
  },

  async remove(req: Request, res: Response) {
    const userId = req.user!.userId;
    const { appointmentId } = req.params;

    const appointment = await prisma.appointments.findFirst({
      where: { id: appointmentId, user_id: userId },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }

    await prisma.appointments.delete({ where: { id: appointmentId } });
    await redis.zrem(REMINDER_KEY, appointmentId);

    res.status(204).send();
  },
};

async function scheduleReminder(appointmentId: string, scheduledAt: Date | null, reminderMinutes: number | null) {
  if (!scheduledAt || !reminderMinutes || reminderMinutes <= 0) return;

  const reminderTime = scheduledAt.getTime() - reminderMinutes * 60 * 1000;
  if (reminderTime <= Date.now()) return;

  await redis.zadd(REMINDER_KEY, reminderTime, appointmentId);
}

async function scheduleFeedback(appointmentId: string, scheduledAt: Date | null, durationMinutes: number | null) {
  if (!scheduledAt) return;
  const durationMs = (typeof durationMinutes === 'number' && durationMinutes > 0 ? durationMinutes : 60) * 60 * 1000;
  const offsetMs = 15 * 60 * 1000; // send 15 minutes after expected end
  const feedbackTime = scheduledAt.getTime() + durationMs + offsetMs;
  if (feedbackTime <= Date.now()) return;
  await redis.zadd(FEEDBACK_KEY, feedbackTime, appointmentId);
}
