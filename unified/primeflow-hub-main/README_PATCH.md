# Patch 9 — Login + Supabase + pnpm/Docker

Este patch adiciona arquivos e ajustes necessários para:

- Atualizar o endpoint `/api/auth/login` com validação Zod, bcrypt e JWT.
- Disponibilizar clientes Supabase (server e web) e middleware opcional de autenticação via Supabase.
- Incluir exemplos de `.env` para API/Worker e Web (Vite).
- Padronizar imagens Docker (API, Worker, Web) usando pnpm e docker-compose com proxy Nginx.
- Adicionar script para seed do usuário admin `admin@primezapia.com` (senha `123456`).

## Passos sugeridos

1. Garanta que os novos arquivos foram copiados para o repositório (`apps/api/src/routes/auth.login.ts`, `apps/api/src/lib/supabase.server.ts`, `apps/api/src/middleware/auth.supabase.ts`, `scripts/seed-admin.ts`, `docker-compose.yml`, `apps/*/Dockerfile`, `nginx/nginx.conf`, `.env.example`, `.env.web.example`, `README_PATCH.md`).
2. Ajuste o `src/app.ts` (ou arquivo equivalente como `apps/api/src/index.ts`) para registrar middlewares CORS/Helmet/JSON e a nova rota de login.
3. Inclua o modelo `User` no `prisma/schema.prisma` (veja `prisma/snippets/User_model.prisma`) e execute as migrações.
4. Preencha `.env` (API/Worker) e `.env.web` (Vite) com as credenciais reais do Supabase/DB.
5. Execute:
   ```bash
   pnpm prisma migrate deploy
   pnpm tsx scripts/seed-admin.ts
   ```
6. Teste o login com:
   ```bash
   curl -sS -i -X POST https://api.primezapia.com/api/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@primezapia.com","password":"123456"}'
   ```

Verifique também as configurações de CORS e JWT no `.env` para garantir que o fluxo de autenticação funcione corretamente.
