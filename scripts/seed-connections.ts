import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function esc(val: string) {
  return String(val).replace(/'/g, "''");
}

async function ensureIntegration(userId: string, provider: string) {
  const existing = await prisma.integrations.findFirst({ where: { user_id: userId, platform: 'WHATSAPP' } as any });
  if (existing) return existing;
  return prisma.integrations.create({
    data: {
      user_id: userId,
      platform: 'WHATSAPP',
      name: 'WhatsApp Default',
      status: 'DISCONNECTED',
      metadata: { provider }
    } as any
  });
}

async function insertWhatsappConnection(userId: string, integrationId: string) {
  // Check table exists
  const existsRows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `select exists (
       select 1 from information_schema.tables
       where table_schema = 'public' and table_name = 'whatsapp_connections'
     ) as exists`
  );
  const tableExists = Boolean(existsRows?.[0]?.exists);
  if (!tableExists) {
    console.warn('⚠️  Tabela public.whatsapp_connections ausente; pulei a inserção (migrations Supabase não aplicadas).');
    return;
  }

  // Detect available columns and build minimal insert
  const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `select column_name from information_schema.columns where table_schema='public' and table_name='whatsapp_connections'`
  );
  const names = new Set(cols.map((c) => c.column_name));
  const candidates = ['user_id', 'integration_id', 'name', 'status'];
  const useCols = candidates.filter((c) => names.has(c));

  // Require at least linkage columns
  if (!useCols.includes('user_id') || !useCols.includes('integration_id')) {
    console.warn('⚠️  Tabela whatsapp_connections não possui colunas esperadas (user_id/integration_id). Pulei inserção.');
    return;
  }

  const valuesMap: Record<string, string> = {
    user_id: `'${esc(userId)}'`,
    integration_id: `'${esc(integrationId)}'`,
    name: `'WhatsApp Default'`,
    status: `'CONNECTING'`
  };
  const valuesSql = useCols.map((c) => valuesMap[c] ?? 'NULL').join(', ');
  const sql = `insert into public.whatsapp_connections (${useCols.join(',')}) values (${valuesSql}) on conflict do nothing`;
  await prisma.$executeRawUnsafe(sql);
}

async function main() {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@primezapia.com';
  const DEFAULT_PROVIDER = (process.env.WHATSAPP_PROVIDER ?? 'venom').toUpperCase();

  const user = await prisma.public_users.findFirst({ where: { email: ADMIN_EMAIL } });
  if (!user) {
    console.error('❌ Usuário admin não encontrado. Rode primeiro: pnpm seed:admin');
    process.exit(1);
  }

  const integration = await ensureIntegration(user.id, DEFAULT_PROVIDER);
  await insertWhatsappConnection(user.id, integration.id).catch((e) => {
    console.warn('⚠️  Falha ao inserir em whatsapp_connections:', (e as any)?.message ?? e);
  });

  console.log('✅ Integração WhatsApp pronta:', integration.id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
