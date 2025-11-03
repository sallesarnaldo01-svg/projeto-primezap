# Patch 9 — Login + Supabase + pnpm/Docker

Este patch adiciona arquivos e diffs necessários para:
- Corrigir o endpoint de login (`/api/auth/login`) com validação, bcrypt e JWT.
- Configurar clientes Supabase (server e web) e middleware opcional de Auth.
- Incluir exemplos de `.env` para API/Worker e Web (Vite).
- Padronizar Docker com pnpm (Dockerfiles, docker-compose e Nginx).
- Scripts de seed do usuário admin.
