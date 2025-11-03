// Script para criar usuário supremo - Primeflow V8
// Email: admin@primezapia.com
// Senha: 123456

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdminUser() {
  console.log('🔧 Criando usuário supremo...');

  try {
    // Hash da senha
    const passwordHash = await bcrypt.hash('123456', 10);

    // Criar ou atualizar usuário
    const user = await prisma.user.upsert({
      where: {
        email: 'admin@primezapia.com',
      },
      update: {
        role: 'SUPER_ADMIN',
        isActive: true,
        isVerified: true,
        updatedAt: new Date(),
      },
      create: {
        email: 'admin@primezapia.com',
        passwordHash: passwordHash,
        name: 'Administrador Supremo',
        role: 'SUPER_ADMIN',
        isActive: true,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log('✅ Usuário supremo criado com sucesso!');
    console.log('');
    console.log('📧 Email:', user.email);
    console.log('🔑 Senha: 123456');
    console.log('👑 Role:', user.role);
    console.log('');
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminUser();
