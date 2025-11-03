# Atualização Definitiva – Execução (2025-11-02)

Este arquivo resume os ajustes aplicados hoje e o que falta para concluir o plano de ação no Docker de produção.

## Docker em execução (qual composição)

- Os comandos anteriores (`docker compose -f docker-compose.yml ...`) indicam uso do compose na raiz, sem `container_name` fixo
  (nomes como `worker-1`). Esse arquivo estava vazio; restaurei um `docker-compose.yml` funcional baseado no pacote `docker/docker-compose.yml`
  com correção no Redis para evitar `MISCONF`.

## Alterações aplicadas no repositório

- `docker-compose.yml` (raiz): serviços `postgres`, `redis`, `api`, `worker`, `frontend` restaurados; Redis com:
  `--save "" --appendonly no --stop-writes-on-bgsave-error no`.
  - Removido o campo `version` (Compose v2 ignora; evita warning).
- `src/pages/Leads.tsx`: reimplementado para usar a API real (`/api/leads`) e ação `POST /leads/distribute`.
- Edge Functions (Supabase): `ai-chat`, `ai-function-call`, `ai-agent-execute` re‑deploy com suporte a provedores gateway (Mannus/Gemini/ChatGPT).
 - `docker/docker-compose.yml`: alinhado Redis com flags anti‑MISCONF; removido `version` para silenciar aviso do Docker Compose.

## Próximos passos operacionais

1. Subir containers (produção):
   - `docker compose up -d redis worker`
   - (opcional) `docker compose up -d api frontend`

2. Parear WhatsApp:
   - Acesse “Conexões” → gerar QR → escanear → verificar `CONNECTED`.

3. Segredos de IA (Supabase Cloud – ref `pkcvpdbnygcgbgvdqton`):
   - `supabase secrets set LOVABLE_API_KEY=<sua_chave>`
   - (opcional) `AI_PROVIDER_DEFAULT=gemini`

4. Rebuild do frontend via Docker:
   - `docker compose build frontend && docker compose up -d frontend`

## Validação rápida

- API saudável: `GET /api/health` (via Nginx) responde 200.
- Frontend: abre sem 404/401 em `contact_lists/campaigns` (Supabase novo via `.env.web`).
- Leads: listagem e distribuição usando API.
- Worker: filas destravadas (Redis sem MISCONF) e QR disponível.

## Estado atual em produção (após ajustes)

- Nginx público (80/443) ativo e apontando para `api:4000` e `frontend:80`.
- API (Docker) saudável e acessível em `https://api.primezapia.com/api/health`.
- Frontend publicado e servindo `https://primezap.primezapia.com/` com 200.
- Worker ativo e conectado ao Redis; pronto para pareamento de WhatsApp.
- Fallback temporário: API/Worker usando Postgres local via `docker-compose.override.yml` até liberar saída 5432/IPv6 para o Supabase.

Observação sobre Supabase (migrations)

- O host do banco (`db.pkcvpdbnygcgbgvdqton.supabase.co`) resolve atualmente apenas para IPv6 (AAAA). O servidor não tem rota IPv6 de saída; por isso `psql`/Prisma retornavam `Network unreachable`/`P1001`.
- Alternativas para concluir as migrations no Supabase:
  - Habilitar IPv6 de saída no host (ou via Cloudflare WARP) e repetir o `prisma migrate deploy`.
  - Solicitar ao provedor/Projeto Supabase suporte a registro A (IPv4) para o endpoint do banco.
  - Aplicar as migrations pelo SQL Editor do Supabase (ordem conforme diretório `prisma/migrations`).

## Pendências gerais do Plano

- Ajustar telas que ainda leem Supabase direto para a API.
- Definir e validar IA (secret do gateway) e executar quick tests de functions.
- Fechar ajustes de Realtime (Socket.IO) e métricas.
