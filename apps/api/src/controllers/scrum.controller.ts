import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { emitToTenant } from '../lib/socket.js';
import { AppError } from '../middleware/error.js';

class ScrumController {
  // Teams
  async listTeams(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    
    const teams = await prisma.scrumTeam.findMany({
      where: { tenant_id: tenantId } as any,
      include: {
        team_members: true as any,
        sprints: { take: 1, orderBy: { start_date: 'desc' as any } } as any,
        _count: { select: { team_members: true, sprints: true } } as any,
      } as any,
      orderBy: { created_at: 'desc' as any } as any,
    });

    res.json(teams);
  }

  async createTeam(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { name, description, members } = req.body;

    const team = await prisma.scrumTeam.create({
      data: {
        tenant_id: tenantId,
        name,
        description,
      } as any,
    });

    emitToTenant(tenantId, 'scrum:team:created', team);
    res.status(201).json(team);
  }

  async updateTeam(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { name, description } = req.body;

    const team = await prisma.scrumTeam.update({
      where: { id },
      data: { name, description },
    });

    emitToTenant(tenantId, 'scrum:team:updated', team);
    res.json(team);
  }

  // Sprints
  async listSprints(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { teamId } = req.query;

    const sprints = await prisma.sprint.findMany({
      where: {
        scrum_teams: { tenant_id: tenantId } as any,
        ...(teamId ? { team_id: teamId as string } : {}),
      } as any,
      include: {
        backlog_items: true as any,
        scrum_teams: { select: { name: true } } as any,
      } as any,
      orderBy: { start_date: 'desc' as any } as any,
    });

    res.json(sprints);
  }

  async createSprint(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { teamId, name, startDate, endDate, goal, totalStoryPoints } = req.body;

    // Verify team belongs to tenant
    const team = await prisma.scrumTeam.findFirst({
      where: { id: teamId, tenant_id: tenantId } as any,
    });

    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const sprint = await prisma.sprint.create({
      data: {
        team_id: teamId,
        name,
        start_date: new Date(startDate),
        end_date: new Date(endDate),
        goal,
        status: 'planning',
      } as any,
    });

    emitToTenant(tenantId, 'scrum:sprint:created', sprint);
    res.status(201).json(sprint);
  }

  async updateSprint(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { name, startDate, endDate, goal, status, completedStoryPoints } = req.body;

    // ensure sprint belongs to tenant
    const existing = await prisma.sprint.findUnique({ where: { id } });
    if (!existing) throw new AppError('Sprint not found', 404);
    const sprint = await prisma.sprint.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startDate && { start_date: new Date(startDate) } as any),
        ...(endDate && { end_date: new Date(endDate) } as any),
        ...(goal && { goal }),
        ...(status && { status }),
      } as any,
      include: { backlog_items: true } as any,
    });

    emitToTenant(tenantId, 'scrum:sprint:updated', sprint);
    res.json(sprint);
  }

  async deleteSprint(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    await prisma.sprint.delete({ where: { id } });

    emitToTenant(tenantId, 'scrum:sprint:deleted', { id });
    res.status(204).send();
  }

  // Backlog
  async listBacklog(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { sprintId } = req.query;

    const items = await prisma.backlogItem.findMany({
      where: {
        tenantId,
        ...(sprintId ? { sprintId: sprintId as string } : {}),
      } as any,
      include: {
        sprints: { select: { name: true, status: true } } as any,
      } as any,
      orderBy: [{ priority: 'asc' as any }, { created_at: 'desc' as any }] as any,
    });

    res.json(items);
  }

  async createBacklogItem(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { sprintId, type, title, description, points, priority, assignee, epic } = req.body;

    const item = await prisma.backlogItem.create({
      data: {
        tenantId,
        sprintId,
        type,
        title,
        description,
        points: points || 0,
        priority: priority || 'medium',
        status: 'todo',
        assignee,
        epic,
      } as any,
    });

    emitToTenant(tenantId, 'scrum:backlog:created', item);
    res.status(201).json(item);
  }

  async updateBacklogItem(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const updates = req.body;

    const item = await prisma.backlogItem.update({ where: { id }, data: updates as any });

    emitToTenant(tenantId, 'scrum:backlog:updated', item);
    res.json(item);
  }

  async moveBacklogItem(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const { status } = req.body;

    const item = await prisma.backlogItem.update({ where: { id }, data: { status } as any });

    emitToTenant(tenantId, 'scrum:backlog:moved', item);
    res.json(item);
  }

  async deleteBacklogItem(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    await prisma.backlogItem.delete({ where: { id } });

    emitToTenant(tenantId, 'scrum:backlog:deleted', { id });
    res.status(204).send();
  }

  // Ceremonies
  async listCeremonies(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { teamId } = req.query;

    const ceremonies = await prisma.ceremony.findMany({
      where: {
        scrum_teams: { tenant_id: tenantId } as any,
        ...(teamId ? { team_id: teamId as string } : {}),
      } as any,
      include: {
        scrum_teams: { select: { name: true } } as any,
      } as any,
      orderBy: { scheduled_at: 'asc' as any } as any,
    });

    res.json(ceremonies);
  }

  async createCeremony(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { teamId, name, type, scheduledAt, duration, participants } = req.body;

    const team = await prisma.scrumTeam.findFirst({ where: { id: teamId, tenant_id: tenantId } as any });

    if (!team) {
      throw new AppError('Team not found', 404);
    }

    const ceremony = await prisma.ceremony.create({
      data: {
        team_id: teamId,
        name,
        type,
        scheduled_at: new Date(scheduledAt),
        duration,
        participants: participants || [],
        status: 'SCHEDULED',
      } as any,
    });

    emitToTenant(tenantId, 'scrum:ceremony:created', ceremony);
    res.status(201).json(ceremony);
  }

  async updateCeremony(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;
    const updates = req.body;

    const ceremony = await prisma.ceremony.update({ where: { id }, data: updates as any });

    emitToTenant(tenantId, 'scrum:ceremony:updated', ceremony);
    res.json(ceremony);
  }

  async startCeremony(req: Request, res: Response) {
    const tenantId = req.user!.tenantId;
    const { id } = req.params;

    const ceremony = await prisma.ceremony.update({ where: { id }, data: { status: 'IN_PROGRESS' } as any });

    emitToTenant(tenantId, 'scrum:ceremony:started', ceremony);
    res.json(ceremony);
  }
}

export const scrumController = new ScrumController();
