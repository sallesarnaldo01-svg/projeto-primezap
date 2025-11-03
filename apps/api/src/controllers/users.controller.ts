import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { AuthRequest } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';

/**
 * GET /api/users
 * Lista todos os usuários (apenas admin)
 */
export async function getUsers(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { search, role, isActive, page = '1', limit = '50' } = req.query;

    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }
    
    if (role) {
      where.role = role;
    }
    
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const whereSql: string[] = [];
    const params: any[] = [];

    if (search) {
      whereSql.push('(u.name ILIKE $' + (params.length + 1) + ' OR u.email ILIKE $' + (params.length + 1) + ')');
      params.push(`%${search}%`);
    }
    if (role) {
      whereSql.push('u.role = $' + (params.length + 1));
      params.push(String(role).toLowerCase());
    }
    if (isActive !== undefined) {
      whereSql.push('u.is_active = $' + (params.length + 1));
      params.push(isActive === 'true');
    }

    const whereClause = whereSql.length ? 'WHERE ' + whereSql.join(' AND ') : '';

    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT u.id, u.name, u.email, u.role, u.avatar, u.is_active as "isActive" FROM public.users u ORDER BY u.created_at DESC LIMIT ${limitNum} OFFSET ${offset}`
    );

    const totalRes: Array<{ count: string }> = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::text as count FROM public.users`
    );

    res.json({
      users: rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: parseInt(totalRes[0]?.count ?? '0', 10),
        pages: Math.ceil(parseInt(totalRes[0]?.count ?? '0', 10) / limitNum)
      }
    });
  } catch (error) {
    logger.error({ err: (error as any)?.message, stack: (error as any)?.stack }, 'Error fetching users');
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
}

/**
 * GET /api/users/:id
 * Busca um usuário específico
 */
export async function getUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;

    // Usuários podem ver apenas seu próprio perfil, admins podem ver todos
    if (req.user?.role !== 'ADMIN' && id !== currentUserId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const userRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT u.id, u.name, u.email, u.role, u.avatar, u.is_active as "isActive" FROM public.users u WHERE u.id = $1 LIMIT 1`,
      id
    );
    const user = userRows[0];

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(user);
  } catch (error) {
    logger.error({ error }, 'Error fetching user');
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
}

/**
 * POST /api/users
 * Cria um novo usuário (apenas admin)
 */
export async function createUser(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { name, email, password, role, avatar } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, email e senha são obrigatórios' });
    }

    // Verificar se email já existe
    const existing = await prisma.user.findUnique({
      where: { email }
    });

    if (existing) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role: role || 'AGENT',
        avatar,
        isActive: true,
        tenant: { connect: { id: req.user!.tenantId! } },
        users: {
          // cria registro vinculado em auth.users se não existir; se já existe, omita esse bloco conforme necessidade
          create: {
            email,
            raw_app_meta_data: {},
            raw_user_meta_data: {}
          }
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true,
        createdAt: true
      }
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        tenantId: req.user!.tenantId!,
        type: 'USER_CREATED',
        description: `Usuário "${name}" criado`,
        userId: req.user!.userId!,
        metadata: { newUserId: user.id }
      }
    });

    logger.info({ userId: user.id }, 'User created');
    res.status(201).json(user);
  } catch (error) {
    logger.error({ error }, 'Error creating user');
    res.status(500).json({ error: 'Erro ao criar usuário' });
  }
}

/**
 * PUT /api/users/:id
 * Atualiza um usuário
 */
export async function updateUser(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.userId;
    const { name, email, avatar, password } = req.body;

    // Usuários podem atualizar apenas seu próprio perfil, admins podem atualizar todos
    if (req.user?.role !== 'ADMIN' && id !== currentUserId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const existing = await prisma.user.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Se mudou email, verificar se já existe
    if (email && email !== existing.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email }
      });

      if (emailExists) {
        return res.status(409).json({ error: 'Email já cadastrado' });
      }
    }

    const updateData: any = {
      ...(name && { name }),
      ...(email && { email }),
      ...(avatar !== undefined && { avatar })
    };

    // Se mudou senha, fazer hash
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        isActive: true
      }
    });

    logger.info({ userId: user.id }, 'User updated');
    res.json(user);
  } catch (error) {
    logger.error({ error }, 'Error updating user');
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
}

/**
 * PUT /api/users/:id/role
 * Atualiza role de um usuário (apenas admin)
 */
export async function updateUserRole(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { role } = req.body;

    if (!role) {
      return res.status(400).json({ error: 'Role é obrigatória' });
    }

    const validRoles = ['ADMIN', 'MANAGER', 'AGENT', 'USER'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Role inválida' });
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true
      }
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        tenantId: req.user!.tenantId!,
        type: 'USER_ROLE_CHANGED',
        description: `Role de "${user.name}" mudou de ${user.role} para ${role}`,
        userId: req.user!.userId!,
        metadata: { targetUserId: id, oldRole: user.role, newRole: role }
      }
    });

    logger.info({ userId: id, role }, 'User role updated');
    res.json(updatedUser);
  } catch (error) {
    logger.error({ error }, 'Error updating user role');
    res.status(500).json({ error: 'Erro ao atualizar role' });
  }
}

/**
 * PUT /api/users/:id/status
 * Ativa/desativa um usuário (apenas admin)
 */
export async function updateUserStatus(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive deve ser boolean' });
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Não permitir desativar a si mesmo
    if (id === req.user?.userId && !isActive) {
      return res.status(400).json({ error: 'Não é possível desativar seu próprio usuário' });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        tenantId: req.user!.tenantId!,
        type: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        description: `Usuário "${user.name}" ${isActive ? 'ativado' : 'desativado'}`,
        userId: req.user!.userId!,
        metadata: { targetUserId: id }
      }
    });

    logger.info({ userId: id, isActive }, 'User status updated');
    res.json(updatedUser);
  } catch (error) {
    logger.error({ error }, 'Error updating user status');
    res.status(500).json({ error: 'Erro ao atualizar status' });
  }
}

/**
 * DELETE /api/users/:id
 * Deleta um usuário (apenas admin)
 */
export async function deleteUser(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const { id } = req.params;

    // Não permitir deletar a si mesmo
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Não é possível deletar seu próprio usuário' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            conversations: true,
            ticketAssignments: true,
            ticketCreations: true,
            deals: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se tem dados associados
    if (user._count.conversations > 0 || user._count.ticketAssignments > 0 || user._count.ticketCreations > 0 || user._count.deals > 0) {
      return res.status(409).json({ 
        error: 'Não é possível deletar usuário com dados associados. Desative o usuário em vez disso.',
        counts: user._count
      });
    }

    await prisma.user.delete({
      where: { id }
    });

    // Registrar atividade
    await prisma.activity.create({
      data: {
        tenantId: req.user!.tenantId!,
        type: 'USER_DELETED',
        description: `Usuário "${user.name}" deletado`,
        userId: req.user!.userId!,
        metadata: { deletedUserId: id }
      }
    });

    logger.info({ userId: id }, 'User deleted');
    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    logger.error({ error }, 'Error deleting user');
    res.status(500).json({ error: 'Erro ao deletar usuário' });
  }
}
