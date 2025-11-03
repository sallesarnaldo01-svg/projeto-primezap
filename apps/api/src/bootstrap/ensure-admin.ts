import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';

/**
 * Ensures there is at least one admin user in a fresh install.
 * - Runs only when there are zero users in public_users.
 * - Creates a default tenant and an admin user using environment variables.
 * - Safe to call on every boot; it no-ops after the first successful creation.
 */
export async function ensureInitialAdmin() {
  try {
    const usersCount = await prisma.public_users.count();
    if (usersCount > 0) return;

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@primezapia.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';
    const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
    const DEFAULT_TENANT_ID = process.env.SEED_TENANT_ID || '00000000-0000-0000-0000-000000000001';

    const tenant = await prisma.tenants.upsert({
      where: { id: DEFAULT_TENANT_ID },
      update: { name: 'PrimeZapAI' },
      create: { id: DEFAULT_TENANT_ID, name: 'PrimeZapAI', settings: {} },
    });

    // Ensure an auth.users row exists (Supabase auth schema mapping)
    const authUser = await prisma.auth_users.upsert({
      where: { email: ADMIN_EMAIL },
      update: { email: ADMIN_EMAIL },
      create: { email: ADMIN_EMAIL, raw_app_meta_data: {}, raw_user_meta_data: {} },
    });

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

    await prisma.public_users.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        name: ADMIN_NAME,
        tenantId: tenant.id,
        passwordHash,
        role: 'admin',
        isActive: true,
      },
      create: {
        id: authUser.id,
        email: ADMIN_EMAIL,
        name: ADMIN_NAME,
        tenantId: tenant.id,
        passwordHash,
        role: 'admin',
        isActive: true,
      },
    });
    // eslint-disable-next-line no-console
    console.log(`✅ Initial admin ensured: ${ADMIN_EMAIL}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('⚠️ Failed to ensure initial admin (will continue):', err);
  }
}

