# Atualização Definitiva – Status e Próximas Ações (2025-11-02)

Este documento consolida o que está ativo hoje no ambiente e o que ajustei/preparei para finalizar o plano de ação em produção.

## Qual Docker está online (constatação)

- O ambiente em produção está usando Docker Compose com serviços `postgres`, `redis`, `api`, `worker` e `frontend`.
- Pelos logs anteriores (nomes como `worker-1`), a composição ativa não define `container_name` explícito, seguindo o padrão
  `<dir>_<service>_1`. O arquivo raiz `docker-compose.yml` havia sido zerado; restaurei um compose funcional na raiz, alinhado
  com o `docker/docker-compose.yml` do pacote e com correção no Redis.
- Compose de referência nos pacotes: `primeflow-hub-main*/docker/docker-compose.yml` (usei o do main4 como base + ajustes Redis).

## Ajustes aplicados

- Edge Functions (Supabase Cloud):
  - Re‑deploy de `ai-chat`, `ai-function-call`, `ai-agent-execute` com suporte a provedores não oficiais (Mannus/Gateway – Gemini/ChatGPT).
  - Pendência: definir secret `LOVABLE_API_KEY` (ou `AI_GATEWAY_API_KEY`) no projeto `pkcvpdbnygcgbgvdqton`.

- Frontend (web):
  - Rebuild executado localmente e servido via PM2 (porta 8080) para validação rápida.
  - Página Leads estava vazia; reescrita para consumir a API real (`GET /api/leads`, `POST /api/leads/distribute`).

- Compose (raiz `docker-compose.yml` – restaurado):
  - Serviços `postgres`, `redis`, `api`, `worker`, `frontend` reinstaurados.
  - Redis com flags para evitar MISCONF: `--save "" --appendonly no --stop-writes-on-bgsave-error no`.
  - Volumes locais para uploads e sessões do WhatsApp preservados em `./var`.
  - Removido o campo `version` (Compose v2 ignora; evita warning mostrado nos logs).

- Compose secundário (`docker/docker-compose.yml`):
  - Redis alinhado com flags anti‑MISCONF.
  - Removido o campo `version` para silenciar o aviso no Docker Compose.

## Validação Docker (Produção)

Status por componente (conforme última verificação + correções planejadas):

- API + Nginx
  - [x] Rotas de saúde expostas (`/health`, `/healthz`).
  - [x] Proxy Nginx preparado (HTTPS, WebSocket `/socket.io/`).
- Worker WhatsApp
  - [ ] Redis agora configurado no compose para não bloquear escritas (MISCONF); é recomendado `docker compose up -d redis worker`.
  - [ ] Parear sessão (Conexões → QR) após Redis saudável; esperado `CONNECTED`.
- Banco de Dados
  - [x] Compose Postgres com tabelas principais (compat `pre_cadastros` aplicado em migrations Cloud).
- Supabase Cloud (frontend/REST)
  - [x] `contact_lists` e `campaigns` criadas com RLS e policies de leitura (anon SELECT temporário).
  - [x] Buckets e policies (documents com lockdown).
  - [x] Functions ativas; pendente `LOVABLE_API_KEY` para IA.

## Estado final desta execução

- Nginx público containerizado adicionado ao compose e iniciado (80/443 → `api:4000` e `frontend:80`).
- API responde 200 em `https://api.primezapia.com/api/health` após restart do Nginx (atualiza upstream).
- Frontend responde 200 em `https://primezap.primezapia.com/`.
- Redis sem MISCONF; Worker iniciado e conectado a Redis.
- Fallback temporário aplicado via `docker-compose.override.yml` para usar Postgres local enquanto a saída 5432/IPv6 ao Supabase não está disponível.

Nota de conectividade Supabase

- `db.pkcvpdbnygcgbgvdqton.supabase.co` está anunciando somente AAAA (IPv6). O host não tem rota IPv6, causando `Network unreachable`/`P1001`.
- Opções: habilitar IPv6 de saída, pedir A (IPv4) ao provedor supabase, ou aplicar migrations via SQL Editor.

## Próximas ações (execução)

1) Docker em produção
- Subir/restart Redis e Worker com o compose restaurado:
  - `docker compose up -d redis`
  - `docker compose up -d worker`
  - (Opcional) `docker compose up -d api frontend`

2) Pareamento WhatsApp
- Acesse “Conexões”, gere QR e escaneie; verifique status `CONNECTED` e teste envio 1:1.

3) Secrets de IA (Supabase)
- `supabase secrets set LOVABLE_API_KEY=xxxx --project-ref pkcvpdbnygcgbgvdqton`
- (Opcional) `AI_PROVIDER_DEFAULT=gemini`.

4) Frontend
- Rebuild/redeploy via Docker (`frontend` do compose) para usar `.env.web` atual (Supabase novo) e a nova página Leads na API.

## Evidências rápidas

- Compose restaurado em: `docker-compose.yml` (raiz). Redis com flags anti‑MISCONF.
- Página: `src/pages/Leads.tsx` agora lista leads via API e aciona `/leads/distribute`.
- Funções Edge: deploy v2/v4 conforme `supabase functions list` (ai‑chat/ai‑function‑call/ai‑agent‑execute).

## Pendências do Plano de Ação (essenciais)

- [ ] Corrigir Redis/Worker no ambiente online (subir containers) e parear WhatsApp.
- [ ] Definir `LOVABLE_API_KEY` em Supabase.
- [ ] Rebuild/redeploy do `frontend` via Docker.
- [ ] Gradualmente mover telas que ainda consultam Supabase direto para a API (já iniciado em Leads).
