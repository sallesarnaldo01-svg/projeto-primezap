import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_TENANT_ID = process.env.SEED_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@primezapia.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '123456';
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Administrador';

async function ensureTenant() {
  const tenantName = 'PrimeZapAI';

  return prisma.tenants.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: tenantName },
    create: {
      id: DEFAULT_TENANT_ID,
      name: tenantName,
      settings: {}
    }
  });
}

async function ensureAuthUser(email: string) {
  const existing = await prisma.auth_users.findFirst({
    where: { email }
  });

  if (existing) {
    return existing;
  }

  return prisma.auth_users.create({
    data: {
      email,
      raw_app_meta_data: {},
      raw_user_meta_data: {}
    }
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const tenant = await ensureTenant();
  const authUser = await ensureAuthUser(ADMIN_EMAIL);

  await prisma.public_users.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      name: ADMIN_NAME,
      tenantId: tenant.id,
      passwordHash,
      role: 'admin',
      isActive: true
    },
    create: {
      id: authUser.id,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      tenantId: tenant.id,
      passwordHash,
      role: 'admin',
      isActive: true
    }
  });

  console.log('✅ Admin seed criado/atualizado:', ADMIN_EMAIL);
  console.log('👤 Tenant ID:', tenant.id);
}

main()
  .catch((error) => {
    console.error('❌ Falha ao executar seed do admin:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
