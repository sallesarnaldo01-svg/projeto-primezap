import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resolveTenantId(): Promise<string> {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@primezapia.com';
  const existingUser = await prisma.public_users.findFirst({ where: { email: ADMIN_EMAIL } });
  if (existingUser?.tenantId) return existingUser.tenantId;

  const DEFAULT_TENANT_ID = process.env.SEED_TENANT_ID ?? '00000000-0000-0000-0000-000000000001';
  const tenant = await prisma.tenants.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: { name: 'PrimeZapAI' },
    create: { id: DEFAULT_TENANT_ID, name: 'PrimeZapAI', settings: {} },
  });
  return tenant.id;
}

async function seedStages(tenantId: string) {
  const stages = [
    { name: 'Descoberta', color: '#94a3b8', displayOrder: 10 },
    { name: 'Qualificação', color: '#60a5fa', displayOrder: 20 },
    { name: 'Proposta', color: '#f59e0b', displayOrder: 30 },
    { name: 'Ganho', color: '#10b981', displayOrder: 40, isFinal: true },
    { name: 'Perdido', color: '#ef4444', displayOrder: 50, isFinal: true },
  ];
  for (const s of stages) {
    const existing = await prisma.stages.findFirst({ where: { tenantId, name: s.name } as any });
    if (existing) {
      await prisma.stages.update({
        where: { id: existing.id },
        data: { color: s.color, displayOrder: s.displayOrder as any, isFinal: (s as any).isFinal ?? false } as any,
      } as any);
    } else {
      await prisma.stages.create({
        data: { tenantId, name: s.name, color: s.color, displayOrder: s.displayOrder as any, isFinal: (s as any).isFinal ?? false } as any,
      } as any);
    }
  }
}

async function seedTags(tenantId: string) {
  const categories = ['CRM', 'Documentos'];
  const catIds: Record<string, string> = {};
  for (const name of categories) {
    const cat = await prisma.tag_categories.upsert({
      where: { tenantId_name: { tenantId, name } as any },
      update: {},
      create: { tenantId, name },
    } as any);
    catIds[name] = cat.id;
  }

  const tags = [
    { name: 'Alta Prioridade', category: 'CRM', color: '#ef4444' },
    { name: 'Novo', category: 'CRM', color: '#3b82f6' },
    { name: 'Documento Pendente', category: 'Documentos', color: '#f59e0b' },
  ];
  for (const t of tags) {
    const tag = await prisma.tags.findFirst({ where: { tenantId, name: t.name } as any });
    if (tag) {
      await prisma.tags.update({ where: { id: tag.id }, data: { color: t.color, isActive: true as any } as any } as any);
    } else {
      await prisma.tags.create({ data: { tenantId, name: t.name, color: t.color, categoryId: catIds[t.category] } as any } as any);
    }
  }
}

async function main() {
  const tenantId = await resolveTenantId();
  await seedStages(tenantId);
  await seedTags(tenantId);
  console.log('✅ CRM mínimo seed aplicado para tenant:', tenantId);
}

main()
  .catch((err) => {
    console.error('❌ Seed CRM mínimo falhou:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
