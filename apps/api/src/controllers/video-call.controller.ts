import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { emitToTenant } from '../lib/socket.js';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

class VideoCallController {
  async createRoom(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { topic, participants } = req.body;

    // Generate unique room name
    const roomName = `room-${Date.now()}`;

    // Create video call record (video_calls model uses snake_case fields)
    const videoCall = await prisma.videoCall.create({
      data: {
        tenant_id: tenantId,
        room_name: roomName,
        host_id: req.user!.userId,
        title: topic || 'Meeting',
        started_at: new Date(),
        participants: participants || []
      }
    });

    // Generate JWT token for Jitsi (if using self-hosted with JWT)
    const signJwt =
      (jwt as typeof import('jsonwebtoken')).sign ??
      (jwt as { default?: typeof import('jsonwebtoken') }).default?.sign;

    if (typeof signJwt !== 'function') {
      throw new Error('JWT indisponível para gerar token');
    }

    const jitsiToken = signJwt(
      {
        context: {
          user: {
            id: req.user!.userId,
            name: req.user!.name || 'User',
            email: req.user!.email
          }
        },
        room: roomName,
        aud: 'jitsi',
        iss: 'primeflow',
        sub: 'meet.primeflow.app',
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 4) // 4 hours
      },
      env.JWT_SECRET
    );

    emitToTenant(tenantId, 'video:call:created', {
      ...videoCall,
      token: jitsiToken
    });

    res.status(201).json({
      ...videoCall,
      token: jitsiToken,
      jitsiUrl: `https://meet.jit.si/${roomName}`
    });
  }

  async endCall(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    // Ensure call belongs to tenant
    const existing = await prisma.videoCall.findUnique({ where: { id } });
    if (!existing || existing.tenant_id !== tenantId) {
      return res.status(404).json({ error: 'Chamada não encontrada' });
    }

    const videoCall = await prisma.videoCall.update({
      where: { id },
      data: { ended_at: new Date() }
    });

    emitToTenant(tenantId, 'video:call:ended', videoCall);
    res.json(videoCall);
  }

  async listCalls(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { title } = req.query as { title?: string };

    const calls = await prisma.videoCall.findMany({
      where: {
        tenant_id: tenantId,
        ...(title ? { title: { contains: title, mode: 'insensitive' } as any } : {})
      },
      orderBy: { started_at: 'desc' as any },
      take: 50
    });

    res.json(calls);
  }
}

export const videoCallController = new VideoCallController();
