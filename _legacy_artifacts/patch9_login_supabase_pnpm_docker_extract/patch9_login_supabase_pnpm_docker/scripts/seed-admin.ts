import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma'; // ajuste caminho

async function main() {
  const email = 'admin@primezapia.com';
  const password = '123456';
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    create: { email, name: 'Admin', passwordHash },
    update: { passwordHash },
  });

  console.log('Admin seed ok:', email);
}

main().catch((e) => { console.error(e); process.exit(1); });
