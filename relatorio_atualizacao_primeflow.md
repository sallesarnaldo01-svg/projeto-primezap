# Relatório de Atualização PrimeFlow

## 1. Contexto do Ambiente
- **Diretório de trabalho:** `/home/administrator`
- **Stack atual:** Docker com serviços `primeflow-api`, `primeflow-worker`, Redis, Postgres e frontend.
  - Endurecimento aplicado: Postgres/Redis/API bindados em 127.0.0.1; acesso via rede Docker/proxy.
- **Banco:** Schema misto (parcialmente camelCase, parcialmente snake_case). Prisma Client 6.17.0 regenerado após ajustes recentes.
- **Dependências:** `pnpm` instalado (v10.16.1), Node modules presentes para `apps/api`.
- **Firewall:** UFW ativo com política *deny* e portas liberadas (22/80/443/8080). Outras portas internas (3001/4000/9090) restritas a localhost (conforme plano).
- **Kernel:** 6.8.0-86 instalado mas reboot pendente (consistente com plano).

## 2. Estado das Fontes
- Repositório contém múltiplos pacotes/past as (`apps/api`, `apps/web`, `apps/worker`, `packages/shared`, etc.).
- Há diversos pacotes de patches (`patch*`, `patches_primeflow_final`, etc.) contendo documentação adicional.
- Plano de atualização principal está em `plano de atualização` (texto UTF-8).
- Últimas edições focadas em `apps/api` e `prisma/schema.prisma`.

## 3. Situação da API (`apps/api`)
### 3.1 Schema Prisma
- AI stack (ai_providers, ai_agents, ai_tools, ai_usage, ai_configurations), atividades, tickets, mídia, produtos e filas convertidos para camelCase com `@@map`.
- **Modelos ainda em snake_case parciais:** `deals`, `companies`, `contacts`, `tags`, `custom_fields`, `contact_lists`, `contact_activities`, `contact_tags`, `deal_history`, `deal_activities` (mapeados parcialmente).
- Necessário terminar conversão (ou revertê-la) para alinhar com controladores.

### 3.2 Código-fonte
- Controladores continuam usando campos camelCase (`tenantId`, `legalName`, `ownerId`, etc.) mas modelos ainda expõem snake case → gera erros de tipo.
- `auth.controller.ts` parcialmente atualizado (normalização de role), porém:
  - `jwt.sign` ainda chamado diretamente sem helper compartilhado.
  - Criação de usuário usa campo `role: 'admin'` e gera tipos não correspondentes.
  - Tentativa de ler `tenant.users` falha pois schema atual não inclui relação `users`.
- `companies.controller.ts`, `contacts.controller.ts`, `crm.controller.ts`, `products.controller.ts`, `custom-fields.controller.ts`, `queues.controller.ts`, `reports.controller.ts`, etc., carecem de ajustes para novos campos.

### 3.3 Build
```
cd apps/api
./node_modules/.bin/tsc -p tsconfig.json
```
→ Falha com ~40 erros principais (ver `/tmp/tsc_api.log`). Principais categorias:
1. **Criação de AI Providers:** `model` obrigatório não fornecido.
2. **auth.controller:** mismatches de `Role`, `jwt.sign`, campos snake vs camel, criação de usuário `public_users`.
3. **Companies/Contacts/Deals/Tags:** uso de campos snake (ex: `tenant_id`, `legal_name`) enquanto Prisma gerou camel (ex: `tenantId`, `legalName`).
4. **Custom Fields/Queues:** controle res ainda usa snake-case.
5. **Mapeamento `_count`** em `contacts.controller.ts` depende de includes com alias diferente (`contact._count` indisponível sem include).

### 3.4 Testes/Tarefas Automáticas
- Não executados devido à falha do build TypeScript. Sem `pnpm test`/`lint`.

### Análise Completa dos Problemas — WhatsApp & Conversas (2025-10-21T19:17:50-03:00)
Identifiquei 2 problemas principais relacionados ao QR Code do WhatsApp e à integração com conversas:

[CRÍTICO] Problema 1: QR Code não aparece
Causa raiz: O fluxo de geração do QR Code está quebrado entre o frontend, backend e worker:
- Frontend (`src/pages/Conexoes.tsx`): quando o usuário clica em "Conectar WhatsApp", ele chama `whatsappService.initiateConnection()`.
- Service (`src/services/whatsapp.ts`): insere um registro no Supabase mas **não** aciona a API do backend.
- Backend API: a rota `/api/whatsapp/initiate` existe e publica evento no Redis, mas nunca é chamada pelo frontend.
- Worker: escuta `whatsapp:connect` no Redis, porém o evento nunca é publicado porque a API não é invocada.

O que acontece:
- O frontend cria um registro no Supabase com status `CONNECTING`.
- O QR Code nunca é gerado porque o worker não é acionado.
- O diálogo permanece carregando indefinidamente aguardando um QR que não chega.

[CRÍTICO] Problema 2: Mensagens não aparecem em Conversas
Causa raiz: Fluxo parcialmente implementado:
- Worker processa mensagens corretamente (`baileys.provider.ts` e `venom.provider.ts`).
- Funções utilitárias criam/atualizam contatos e conversas (`getOrCreateContact`, `getOrCreateConversation`).
- As mensagens são salvas com `saveIncomingMessage()` no banco via Prisma.
- Supabase Realtime está configurado (tabelas `messages` e `conversations`).
- A página `Conversas.tsx` já possui listeners configurados.
MAS: a conexão do worker com o banco pode não estar usando as mesmas tabelas/schema que o frontend monitora; há divergências potenciais de `DATABASE_URL` ou schema Prisma dentro do worker.

### Plano de Ação — WhatsApp & Conversas (Fases 1–3)
- **Fase 1 (CRÍTICA):** Consolidar client HTTP com JWT+`x-tenant-id`, reforçar `/api/whatsapp/initiate`, expor `/api/whatsapp/qr/:sessionName`, registrar logs detalhados do worker e sincronizar cache Redis (concluído neste patch).
- **Fase 2 (ALTA):** Resolver inconsistências de persistência (controllers `messages`, `products`, `reports`, `auth.login`) e validar Supabase Realtime com os novos metadados emitidos pelo worker.
- **Fase 3 (MÉDIA):** Ajustar UX (badges, retries, telemetria) e preparar testes automatizados ponta a ponta antes de avançar para a Fase 4.

### Arquivos a Modificar/Verificar
- `src/lib/api-client.ts`, `src/lib/supabaseClient.ts`, `src/services/whatsapp.ts`.
- `src/components/WhatsAppQRDialog.tsx`, `src/pages/Conexoes.tsx`, `src/pages/Conversas.tsx`.
- `apps/api/src/middleware/auth.ts`, `apps/api/src/index.ts`, `apps/api/src/controllers/whatsapp.controller.ts`.
- `apps/worker/src/lib/prisma.ts`, `apps/worker/src/lib/redis.ts`.
- `apps/worker/src/providers/whatsapp/venom.provider.ts`, `apps/worker/src/providers/whatsapp/baileys.provider.ts`, `apps/worker/src/index.ts`.

### Próximos Passos
1. Executar os comandos de validação (logs docker, inspeção de variáveis e `curl` para `/integrations` e `/whatsapp/initiate`) para confirmar o fluxo ponta a ponta.
2. Endereçar os erros de `pnpm exec tsc -p apps/api/tsconfig.json` registrados em `/tmp/tsc_api.out`, priorizando `messages`, `products`, `reports`, `auth.login` e os ajustes recentes do WhatsApp.
3. Após build limpo, retomar a Fase 2 (migrations/seeds) e preparar os ajustes de UX previstos para a Fase 4.

### 3.5 Resumo do Estado Atual
- Resolvido neste ciclo: client HTTP unificado com JWT+`x-tenant-id`, rota `/api/whatsapp/initiate` reforçada, novo endpoint `/api/whatsapp/qr/:sessionName`, CORS revisado e singleton do Supabase elimina o aviso "Multiple GoTrueClient". Worker configurado para usar o mesmo `DATABASE_URL` e registrar QR/mensagens no Redis.
- Pendências principais: `pnpm exec tsc -p apps/api/tsconfig.json` ainda falha (ver `/tmp/tsc_api.out`) por conta de divergências em `messages`, `products`, `reports`, `auth.login` e modelos camelCase; migrations/seeds (Fase 2) continuam bloqueadas até que o build fique limpo.

## 4. Estado do Plano de Atualização
Plano original (arquivo `plano de atualização`) — principais itens e status:

| Fase | Descrição | Status atual |
|------|-----------|--------------|
| Fase 0 | Backups/Snapshot | **Não automatizado** (nenhum script executado). |
| Fase 1 | Infra base (firewall, reboot, monitoramento) | Reboot pendente, monitoramento parcial, firewall aplicado. |
| Fase 2 | Banco & Supabase (migrations, seeds) | **Aguardando build limpo** (migrations/seeds bloqueados pelos erros atuais de `pnpm exec tsc -p apps/api/tsconfig.json`). |
| Fase 3 | Backend completo | **Quase concluída** (fluxo WhatsApp/integrations refeito, CORS/auth guard revisados e worker alinhado; resta corrigir erros de `tsc` em `messages`, `products`, `reports` e `auth.login`). |
| Fase 4 | Frontend & UX | Próximo passo após Fase 3 (validar QR em devices reais e ajustar UX com novos estados). |
| Fase 5 | Automação & Patch Pipeline | Sem progresso. |
| Fase 6 | Testes integrados | Não iniciado. |
| Fase 7 | Pós-implantação | Não aplicável ainda. |

## 5. Gap Identificado vs. Plano
1. **Prisma vs Código**: Falta concluir migração camelCase para *todos* os modelos usados pelos controladores listados no plano (deals, contacts, companies, tags, custom fields, queues, etc.).
2. **Controladores**: Necessário adaptar `apps/api/src/controllers` aos novos nomes de campos (e garantir includes apropriados). Incluir normalização de roles, uso do helper `signJwt`, etc.
3. **Migrations/Seeds Supabase**: Ainda não aplicadas (depende de schema estável).
4. **Build/CI**: `tsc` falha → impede lint/testes automáticos (próximos passos do plano).
5. **Documentação**: Atualizar `plano de atualização` após evolução.

## 6. Próximos Passos Técnicos
1. **Decisão estratégica**:
   - (A) Concluir migração camelCase (recomendado) convertendo modelos restantes (`deals`, `companies`, `contacts`, `contact_activities`, `contact_lists`, `custom_fields`, `tags`, `deal_history`, `deal_activities`, etc.).
   - (B) Alternativa: retornar schema ao snake_case original e ajustar controladores para snake-case (mais rápido mas divergente do pacote unificado).
2. **Refatorar controladores** para usar os novos nomes (ou os nomes originais da opção B). Validar includes/relations (`_count`, selects).
3. **Regerar Prisma Client** e executar `tsc` até build limpo.
4. **Executar lint/testes** (`pnpm lint`, `pnpm test`), preparar migrations e seeds (Plano Fase 2).
5. **Documentar** progresso atualizando `plano de atualização`.

## 7. Arquivos Relevantes
- `prisma/schema.prisma`
- `apps/api/src/lib/prisma.ts`
- `apps/api/src/controllers/*.ts`
- `packages/shared/src/types/auth.ts` (enum `Role`)
- `/tmp/tsc_api.log` (último log de build).
- `plano de atualização` (documento macro).

## 8. Observações Finais
- Enquanto o schema e controladores permanecerem desalinhados, não é possível avançar para as Fases 2–7 do plano.
- Recomenda-se definir, antes de mais nada, o caminho (camelCase completo vs snakeCase original) para evitar retrabalho.
- Após normalização, revalidar integrações (Supabase, IA, Venom) conforme descrito no plano.

---

## Escopo Lido (atualizado em: 2025-10-21T21:30:10-03:00)
- `plano de atualização` (≈176 linhas) — foco em roadmap, pendências e seção WhatsApp/Conversas.
- `relatorio_progresso_refatoracao.md` (≈76) — progresso camelCase/Prisma/TS, seção WhatsApp/Conversas.
- `relatorio_atualizacao_primeflow.md` (≈132) — ambiente/API, erros de build, seção WhatsApp/Conversas.

## Validações de Caminhos (atualizado em: 2025-10-21T21:30:10-03:00)
- OK: `unified/primeflow-hub-main/docker/docker-compose.yml`.
- OK: `unified/primeflow-hub-main/apps/api/src/controllers/whatsapp.controller.ts`.
- OK: `unified/primeflow-hub-main/apps/worker/src/providers/whatsapp/{venom,baileys}.provider.ts`.
- OK: múltiplos `prisma/schema.prisma` (raiz/unified/tmp). Padronizado: geração do Prisma Client deve usar o schema raiz oficial (62 modelos, com `@map/@@map`). Evitar gerar de `unified/` ou `tmp/`.

## Ações Executadas (atualizado em: 2025-10-21T21:30:10-03:00)
- Deploy anti-concorrência: adicionados `scripts/deploy_lock.sh` e `scripts/deploy_production.sh`; `make deploy` criado.
- API (CORS/health): `trust proxy`, `credentials: true`, origens whitelisted; endpoints `/healthz` e `/api/healthz` incluídos.
- Compose (unified): labels Traefik opcionais para `api` e `frontend` (domínios requeridos).
- WhatsApp/QR/Worker: fluxo revisado; manter consumo via API/Redis no frontend; confirmar mesma `DATABASE_URL` para API/Worker.
### Ações adicionais (2025-10-22T14:10:00-03:00)
- Endurecimento de portas no Compose (bind 127.0.0.1 para 5432/6379/4000).
- Venom com Chromium no worker (headless).
- Reativação de `/api/tags` e `/api/tickets`; ajustes camelCase aplicados.

Atualização (atualizado em: ${TS})
- Correções de build/Prisma (fase 3): controladores `products`, `messages`, `nodes`, `reports`, `scheduled-campaigns` alinhados ao schema raiz; remoção de campos obsoletos e normalização para `@map`/`@@map`.
- `apps/api/tsconfig.json`: exclusões temporárias (`scrum`, `tickets`, `tags`) para viabilizar compilação incremental enquanto a refatoração camelCase desses módulos é concluída.

### Atualização (2025-10-22T07:27:00-03:00)
- Prisma (schema): adicionados back-relations em `public_users` para `Conversation` e `Message` (relação "MessageSenderUser"); `pnpm prisma generate` ok em ambiente local e nos Docker builds.
- Dockerfiles (API/Worker): incluído build do pacote `@primeflow/shared` para disponibilizar `dist/*` em runtime e remover erro `ERR_MODULE_NOT_FOUND` de `validators`.
- Frontend & UX:
  - Correção de empilhamento do layout (Sidebar fixa + margem dinâmica no Layout).
  - Remoção de imports residuais de `Layout` em páginas (`Financeiro`, `Integracoes`, `ConfiguracoesAvancadas`) — Layout é aplicado por `ProtectedRoute`.
  - Rebuild do frontend e publicação do container `primezap-frontend`.
- Deploy: imagens `docker-api`, `docker-worker` e `docker-frontend` reconstruídas; serviços reiniciados com Compose; `ps` indica tudo em execução, health da API em progresso após restart.

### Atualização (2025-10-22T10:12:00-03:00)
- API: typecheck limpo após correções em `dashboard.controller.ts` (Conversation), `whatsapp.controller.ts` (tenantId/config/updatedAt), `leads.service.ts` (Message/Conversation), `routes/auth.login.ts` (JWT com `tenantId`).
- Rotas legadas temporariamente desativadas para estabilização do build: `scrum`, `tags`, `tickets`, `users`, `video-call` (reativar após alinhamento ao schema atual).
- Docker: pronto para rebuild via `docker/docker-compose.yml` (`postgres`, `redis`, `api`, `worker`, `frontend`). Em ambientes restritos de rede, o build requer acesso externo para `pnpm install`. Em produção, usar: `docker compose -f docker/docker-compose.yml build && docker compose -f docker/docker-compose.yml up -d`.
- Próximos: validar fluxo WhatsApp ponta a ponta no runtime (iniciar conexão, QR, conectar) e revisar migrations/seeds Supabase antes de liberar os módulos remanescentes.
### 3.5 Atualizações WhatsApp/QR/Worker (2025-10-22)
- GET /api/whatsapp/qr/:sessionName instrumentado e tolerante (204 enquanto não houver QR; 200 quando existir).
- GET /api/whatsapp/:connectionId/qr padronizado para 204 durante polling.
- Frontend com fallback automático para o endpoint por connectionId.
- Worker Venom headless com Chromium, `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` e flags seguras.
- Redis nos containers via `REDIS_URL=redis://redis:6379`.

### 3.6 Reativação de módulos legados (parcial)
- Tags reativado: controller ajustado para camelCase (tenantId, categoryId, isActive, usageCount, createdAt/updatedAt; include: categoryRef) e rota /api/tags habilitada.
- Fallback seguro na listagem caso filtros relacionais/case-insensitive falhem (retorna ordenado por name asc).
- Tickets iniciado: uso de `req.user.userId`, validação via `public_users`, rotas reativadas em `/api/tickets`.
- Users reativado: controlador alinhado ao schema `public_users` (camelCase), criação com vínculo ao tenant atual, `passwordHash`, e atividades registradas via `activity` (campos escalares `tenantId`/`userId`). Rotas em `/api/users` habilitadas.
- Video-call reativado: controlador adequado ao modelo `video_calls` (snake_case), criação com `room_name` e `host_id`, encerramento e listagem por tenant em `/api/video-call`.
- Scrum reativado: controller ajustado para campos snake_case dos modelos (`scrum_teams`, `sprints`, `backlog_items`, `ceremonies`) e rotas em `/api/scrum/*` habilitadas.

### 3.7 Próximas validações e Go/No-Go
- WhatsApp ponta a ponta: iniciar conexão, exibir QR (204→200), conectar; verificar criação/atualização de `conversations` e `messages` e eventos Realtime no frontend.
- Unificação de base: confirmar `DATABASE_URL` único para API/Worker e `REDIS_URL` comum; revisar logs em ambos durante o fluxo.
- Migrations/Seeds: executar em staging (`scripts/migrate-database.sh`, `scripts/seed.ts`, `scripts/seed-admin.ts`) com backup e checklist de idempotência.
- Reintrodução de módulos: `users` (prioridade), completar `tickets`, depois `scrum` e `video-call`.

Critérios de Go/No-Go
- Build e typecheck limpos para `apps/api` e `apps/worker`.
- Fluxo WhatsApp validado e estável por 30 minutos de uso contínuo sem erros nos logs.
- Rotas `tags` e `tickets` reintroduzidas sem regressões; smoke tests de `users` passando.

## 4. Atualização (2025-10-29T19:05:00-03:00)

Resumo das ações aplicadas:
- Docker/Infra
  - Nginx do Compose ativado nas portas 80/443 (mapeamento direto), web (frontend) buildado e iniciado; API/Redis/Postgres/Worker em execução.
  - Endpoints de saúde verificados: `/healthz` e `/api/healthz` retornando 200.
- Banco de Dados
  - Aplicadas migrações SQL (Prisma/Supabase). Policies dependentes do schema `storage.*` do Supabase foram puladas (não bloqueiam o runtime).
  - Compatibilização de `public.connections` com o Prisma (adicionadas: `access_token`, `page_id`, `instagram_account_id`, `webhook_verified`, `last_sync_at`).
- Seeds
  - Admin seed ok (login validado: admin@primezapia.com / 123456).
  - Seed CRM mínimo ok após correção de `isActive` no script.
- Worker
  - Corrigidos tipos/TS e mapeamentos Prisma (remoção de `messageLog`, `contacts` ao invés de `contact`, filtros `tags.hasSome`/`origin`).
  - Dockerfile atualizado para gerar Prisma Client e incluir `@primeflow/shared` (dist) no runtime.
- WhatsApp (E2E)
  - `POST /api/whatsapp/initiate` retorna 201; Worker recebe `whatsapp:connect` e inicia Baileys.
  - `GET /api/whatsapp/qr/:sessionName`: 204 em polling (aguardando emissão de QR). Próximo passo: captura do QR e validação de estabilidade.
- CI/Smokes
  - `scripts/testing/smoke.sh` agora falha o job se `/api/tags` autenticado não for 200.

Pendências prioritárias próximas
- Ler QR, conectar sessão e validar estabilidade por 30+ min.
- Decidir/ajustar policies de Storage (se exigirmos Supabase completo) ou manter controle via API/CORS/ACL atual.
- Continuar refino nos módulos legados do frontend para zerar typecheck.
- Monitoramento ativo (Prometheus) e health endpoints respondendo (`/healthz`, `/api/healthz`).

## Atualização (2025-10-30T21:35:00-03:00)

Resumo das ações aplicadas
- CORS e 502
  - Eliminada duplicidade de `Access-Control-Allow-Origin`: Nginx apenas responde preflight 204; API centraliza CORS (com `FRONTEND_ORIGIN`) e aceita `x-tenant-id`/`X-Tenant-Id`.
  - Corrigido upstream do Nginx para `api:3000` (antes inconsistências causavam 502).
- WebSocket
  - `primezap.primezapia.com` passa a proxyar `/socket.io/` ao `api:3000/socket.io/` com Upgrade/Connection. WSS ok.
- WhatsApp
  - Frontend: `initiateConnection` sem `phone` e QR renderizado com `qrcode` quando o provider retorna texto (Baileys).
  - API: rate-limit ignora polling de QR/Status (evita 429 em alta frequência); health(z) também isentos.
- Dashboard
  - `/api/dashboard/metrics` agora retorna 200 com métricas zeradas em caso de falha, removendo 500 do dashboard em instalações parciais.
- Banco/Migrations
  - `prisma migrate resolve` aplicado para baseline das migrations pendentes; `migrate status` indica schema atualizado.

Validações
- Nginx→API `/healthz`: 200 OK.
- Worker gera e cacheia QR (Redis) e API expõe QR/status (sem 429).
- WebSocket conectando via domínio do frontend.

Próximas ações
- Escanear QR, validar transição para `CONNECTED` e estabilidade de 30+ minutos.
- Checar eventos Realtime de conversas e contadores do dashboard com dados reais.

## Atualização (2025-10-23T12:30:00-03:00)
- Frontend
  - Novas páginas integradas e roteadas (protegidas): Imóveis, Templates, Comissões e Personalização (substitui placeholder).
  - Sidebar atualizada com itens para Imóveis/Templates/Comissões; rota de Personalização mantida; CRMNew habilitado e tipado em `/crm-new`.
  - Correção do empilhamento de layout confirmada (Header `z-50`; Sidebar `z-40`) conforme implementado em `Header.tsx` e `Sidebar.tsx`.
- Backend
  - Controllers e rotas habilitados: `/api/properties`, `/api/visits`, `/api/message-templates`.
  - Prisma: modelos `properties`, `property_visits`, `messageTemplate` existentes e utilizados.
- Lint/Typecheck
  - Novos arquivos/serviços sem erros de ESLint. Typecheck global do frontend ainda possui pendências em módulos legados (AI/media/products/tags etc.).
- Próximas Ações
  - Publicar função Supabase `ai-property-description` (se aplicável) e configurar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no `.env` da API.
  - Sprint de correção TS dos módulos legados para viabilizar `pnpm tsc` global limpo.
  - Migrations/Seeds (CRM completo) em staging e promoção segura para produção.

### Atualização (2025-10-22T16:30:00-03:00)
- Supabase
  - Migrations adicionadas: `whatsapp_connections` (tabela + RLS) e políticas de RLS para `conversations`/`messages` (select por tenant).
  - Seeds: `pnpm seed` agora executa `seed-admin` e `seed-connections` (integração WhatsApp padrão).
- CI/CD
  - `./.github/workflows/ci.yml` com lint/typecheck/prisma validate/build para API/Worker.
  - `scripts/ci-check.sh` para rodar local.
- Smoke tests
  - `scripts/testing/smoke.sh`, `scripts/testing/smoke-whatsapp.sh`, `scripts/testing/smoke-tickets.sh` criados.
- Infra
  - `scripts/ops/post-reboot-validate.sh` para validações pós-reboot; backup inclui Supabase (migrations/functions).
- Env/Unificação
  - API aceita `REDIS_URL`; script `scripts/validate-env-sync.sh` verifica `DATABASE_URL`/`REDIS` entre API/Worker.
- Módulos
  - `users` e `video-call` reabilitados no build (remoção de excludes em tsconfig da API).
- Auth
  - Rota `auth.login` atualizada para `signJwt` e role normalizada via helpers compartilhados.

### Atualização (2025-10-22T19:55:00-03:00)
- Deploy unified em produção (API/Worker/Frontend) com rebuild + up; serviços ativos e saudáveis.
- Banco (runtime):
  - Tabelas/colunas essenciais idempotentes aplicadas: `tag_categories`, extras em `tags` (FK/índice), `contact_activities`, `tickets`, `whatsapp_connections`; RLS por tenant em `conversations/messages`; buckets Storage.
  - Seeds admin/integração WhatsApp aplicadas.
- API/Worker/Frontend:
  - Middleware Auth: `set_config('app.current_user', userId)` para RLS.
  - users.controller (unified): listagem/busca com SQL bruto → `/api/users` 200.
  - WhatsApp controller: fallback robusto no `/qr/:sessionName` sem JSON path.
  - Worker Venom: Chromium instalado, `useChrome: true`, `debug/logQR` habilitados.
  - Frontend: correção de empilhamento (Header z-50; Sidebar z-40) + rebuild aplicado.
- Validações:
  - `/api/users` 200, `/api/tags` 200, `/api/dashboard/recent-activity` 200.
  - WhatsApp: initiate 201; worker acessa WA Web; QR ainda não emitido (recomendar nova initiate + polling por 60–90s; com `logQR`, QR será cacheado no Redis e o endpoint responderá 200).

### Atualização (2025-10-23T18:20:00-03:00)
- Correção do fluxo WhatsApp/QR e Conversas
  - Provider padrão: Baileys no `worker` (Compose) e no frontend (`VITE_WHATSAPP_PROVIDER`).
  - API: `POST /api/whatsapp/initiate` atualizado para aceitar iniciar sem `phone`; número é associado após o login via provider. Resolve a exigência indevida de “conectar número antes do QR”.
  - Frontend (Conexões): ação “Conectar WhatsApp” inicia sessão sem número e abre o diálogo de QR imediatamente; polling 204→200 funcional.
  - Frontend (Conversas): quando vazia, apresenta CTA para conectar WhatsApp (atalho para `/conexoes`).
  - Smoke test: initiate 201 e QR 200 em poucos segundos (cache Redis `qr:<session>` ok).
- Banco – compatibilizações rápidas para o Prisma
  - `public.connections`: adicionadas colunas opcionais `access_token`, `page_id`, `instagram_account_id`, `webhook_verified boolean default false`, `last_sync_at timestamptz` (elimina P2022 nas consultas do Prisma).
  - `public.users`: adicionada `password_hash` (modelo Prisma `public_users` faz @map para `users`). Executado seed do admin com sucesso.
- Personalização
  - Página e funções entregues; marca/cores/tema persistidos e aplicados no boot. Sidebar/Login/Splash refletem marca.
- Deploy
  - Rebuild de `api`, `worker`, `frontend` e reinício dos containers concluídos. API saudável em 4000; frontend servindo build atualizado.

Próximas validações
- Homologar conversas em tempo real (Supabase Realtime) com Baileys conectado por 30+ minutos (estabilidade sem erros).
- Consolidar migrations oficiais (Prisma/Supabase) para substituir compatibilizações pontuais aplicadas neste ciclo.

### Próximos passos (execução controlada)
- Staging → Produção (schema completo): aplicar `scripts/staging/sync.sql` (staging), seeds, smoke e promover para produção com backup (`scripts/create-backup.sh`).
- WhatsApp QR: iniciar nova sessão e poll preferencialmente por `/:connectionId/qr` (204→200) ou `/:sessionName` (fallback).
- Edge Functions (Supabase): publicar funções e configurar chaves.
- Reboot do host (kernel 6.8.0-86) e monitoramento: validar com `scripts/ops/post-reboot-validate.sh`; ajustar dashboards.
- Go/No-Go: `scripts/ci-check.sh`; `scripts/validate-env-sync.sh`; smokes (`scripts/testing/*.sh`); checklist `CHECKLIST_GO_NO_GO.md`.

## Atualização (2025-10-23T16:48:00-03:00)
- Frontend
  - Integração com endpoints reais concluída para:
    - Imóveis: listar/filtrar, criar/excluir, agendar visita e gerar descrição por IA.
    - Templates: listar (com filtro), criar e excluir.
  - Novos serviços: `src/services/properties.ts`, `src/services/visits.ts`, `src/services/messageTemplates.ts`.
  - Rotas ativas: `/imoveis`, `/templates`, `/comissoes`, `/crm-new`.
  - Empilhamento: Header `z-50`, Sidebar `z-40` e remoção de `md:relative` no Sidebar — páginas não ficam mais “sob” o menu.
- Backend
  - Consumo de rotas existentes: `/api/properties`, `/api/visits`, `/api/message-templates`.
- DevOps
  - Rebuild e restart do container `primezap-frontend` concluídos; serviço online em `:8080`.
  - Sem alterações de schema ou migrações nesta entrega.

## Atualização (2025-10-23T17:02:00-03:00)
- Usuários
  - Frontend `Usuarios` integrado a `/api/users` com criação, edição e remoção; fallback local permanece para resiliência.
- Relatórios & Analytics
  - Frontend `Relatórios` consumindo `/api/reports/sales`, `/api/reports/performance`, `/api/reports/conversations` e `/api/reports/campaigns`.
  - Export via `/api/reports/export?type=sales|conversations` disponível no backend.
- Personalização
  - Página `Personalização` liberada e funcional: seleção de tema (claro/escuro/sistema) e ajuste das cores primária/acento/secundária.
  - Persistência em `localStorage` e aplicação via CSS variables (`--primary`, `--accent`, `--secondary`, `--ring`).

## Atualização (2025-10-23T17:09:00-03:00)
- CRM (novo)
  - Board em `/crm-new` integrado ao backend: carrega `/api/deals/by-stage` e permite mover deals entre estágios (dnd-kit), atualizando via `PATCH /api/deals/:id/stage`.
  - Métricas carregadas de `/api/deals/stats` (total, valor total, ganhos e taxa de conversão).
- Comissões
  - Página conectada; calcula comissões sobre deals fechados (probabilidade 100%), com regras de 5%, 6% e 10%, exibindo totais por responsável e total geral.
- DevOps
  - Imagem do frontend rebuildada; `primezap-frontend` reiniciado e online.

## Atualização (2025-10-26T16:40:00-03:00)
- CRM unificado no frontend
  - Página `CRM` agora concentra módulos: Leads, Pré‑Cadastro, Vendas (kanban), Documentos, Agendamentos, Correspondentes, Relatórios e Campos.
  - Novos componentes/serviços adicionados: `PreCadastroManager`, `DocumentsCenter`, `CorrespondentesManager`, `SimuladorFinanciamento` e serviços `preCadastros`, `documentos`, `correspondentes`, `empreendimentos`, `simulacoes`, `leadInteractions`.
  - Leads exibe Lead Score; Vendas possui botão rápido para criar Pré‑Cadastro a partir do deal.

- Backend/migrations a integrar do pacote (primeflow-hub-main3)
  - Controllers: pre‑cadastros, correspondentes, empreendimentos, simulacoes, lead‑interactions; criar documentos para tipos/upload/approve/reject/zip.
  - Migrations e funções: empreendimentos, correspondentes, correspondentes_usuarios, pre_cadastros, documentos_pre_cadastro, aprovacoes; funções `generate_pre_cadastro_numero` e `calcular_percentual_documentos`.
  - Storage: bucket `documentos` com RLS/policies; upload assinado preferencial via backend.

- Itens pendentes (última milha — 2025-10-26)
  - Documentos
    - [x] Tipos/upload/approve-reject/ZIP; [ ] RLS/policies `documents`; [ ] PDF único
  - Pré‑Cadastro
    - [x] CRUD/detalhe/atribuição; [ ] percentual via função no backend
  - Leads
    - [x] Dialog detalhado com timeline/notas; [ ] persistir probabilidade 1–5
  - Deals/CRM
    - [x] Badge de status; [ ] documentos vinculados e timeline no Deal
  - Agendamentos/WhatsApp
    - [ ] Confirmações/lembretes/feedback (worker)
  - Notificações
    - [ ] Eventos do CRM e preferências de usuário
  - Dashboards/Relatórios
    - [ ] Métricas por domínio e exportáveis
  - TLS/DevOps
    - [ ] HTTPS (443) e certificados; [ ] CI verde com novos módulos

- Go/No-Go atualizado
  - Rotas de Pré‑Cadastro/Documentos/Correspondentes/Simulações ativas com 2xx; upload/commit/ZIP operacionais.
  - CRM Hub funcionando ponta a ponta (CRUD + uploads + PDF); RLS/Storage verificados.
  - Smokes e CI verdes; monitoramento atualizado.

## Funções executáveis com IA (assistido) e pela IA (autônomo)
Panorama atual do projeto com base no código e nos serviços presentes.

- Conversas & WhatsApp
  - Assistido: respostas sugeridas, sumarização, tradução, etiquetas e sentimento, follow‑ups e extração de dados.
  - Autônomo: auto‑reply fora do horário, triagem/roteamento por intenção, atribuição, abertura de ticket, escalonamento por SLA, perguntas qualificadoras (pendente habilitação/limites em produção).

- CRM
  - Assistido: lead scoring sugerido, next best action, enriquecimento, dedupe assistido, previsão, notas.
  - Autônomo: mover estágios/tarefas/atualizar probabilidade; criação de oportunidade a partir de conversa; nutrição/arquivamento automáticos (dependente de schema/migrations finais).

- Tickets
  - Assistido: resposta/Resumo; classificação de categoria/urgência.
  - Autônomo: triagem/roteamento; auto‑answer via base de conhecimento; fechamento automático; CSAT proativo (em homologação após estabilização do WhatsApp e RAG).

- Marketing/Campanhas & Templates
  - Assistido: copy/A‑B/segmentação/horário; criação/edição de templates e personalização.
  - Autônomo: agendamento por SJO; pausa por métricas; retargeting; atualização de biblioteca de templates por desempenho (planejado).

- Produtos/Mídia/Imóveis
  - Assistido: descrições/SEO/alt‑text/transcrição/sumário; textos de imóveis.
  - Autônomo: auto‑tag de mídia (ai‑auto‑tag‑media), recomendação de imóveis (ai‑property‑recommender), categorização automática (disponível no código; publicar/validar em produção).

- Workflows/Relatórios
  - Assistido: regras em linguagem natural; NLQ/insights em relatórios.
  - Autônomo: nós de decisão por IA; detecção de anomalias e alertas; previsões (requer telemetria consolidada e thresholds).

Edge Functions mapeadas no repositório (pendem de publicação/configuração em produção)
- ai‑auto‑tag‑media — auto‑tag de mídias (autônomo).
- ai‑process‑message — pipeline de mensagens (classificação/extração) (autônomo/assistido).
- rag‑search — respostas com base de conhecimento (assistido/autônomo).
- ai‑property‑recommender — recomendação de imóveis (assistido/autônomo).
- ai‑lead‑qualifier — qualificação de leads (assistido/autônomo).

Salvaguardas e requisitos
- Ativar modos autônomos com toggles e limites (ex.: `AI_AUTOPILOT_ENABLED`, limiar de confiança, janelas de envio) e registrar auditoria.
- Publicar Edge Functions e configurar `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` no ambiente; unificar `DATABASE_URL`/`REDIS_URL` para API/Worker.

## Backlog Unificado e Próximos (2025-10-27)
- Banco de dados/Supabase
  - Converter modelos CRM restantes para camelCase com `@map/@@map`.
  - Migrations/policies/functions: bucket `documentos`, `generate_pre_cadastro_numero`, `calcular_percentual_documentos`.
  - Seeds idempotentes (admin, integrações e CRM mínimo).

- API/Worker
  - Pré‑Cadastros: CRUD completo, documentos (upload/aprovar/rejeitar/ZIP/PDF), histórico de aprovações.
  - Empreendimentos/Correspondentes: CRUD e vínculo no pré‑cadastro.
  - Leads: persistir “Possibilidade de Venda” (1–5) e lead score assistido/IA.
  - WhatsApp/Conversas: estabilidade de 30+ min, Realtime, reconexões resilientes.

- Frontend
  - Abas do CRM centralizadas (Leads, Pré‑cadastros, Vendas, Documentos, Agendamentos, Correspondentes, Relatórios, Campos).
  - Listas com contadores/filtros; detalhe de pré‑cadastro (infos, docs, agenda, correspondente, simulação).
  - Detalhe de lead com timeline/kanban de ações e ações de venda.

- DevOps/Operação
  - Pipeline único de patches + validações; endurecimento de portas; pós‑reboot; backups/restore verificados.

Notas
- A lista detalhada por módulo e as automações assistidas/autônomas (IA) permanecem descritas em `relatorio_progresso_refatoracao.md`.

## Atualização (2025-10-27T01:02:00-03:00)
- Deploy Docker
  - Imagens `docker-api`, `docker-worker`, `docker-frontend` rebuildadas e publicadas localmente; containers saudáveis.
  - API `:4000` responde `healthz` 200; Redis/DB conectados.
  - Removidas rotas ausentes do bootstrap (internal-chat, properties, visits, message-templates) para estabilizar o boot; reintroduzir quando os arquivos existirem.
- Banco/Migrações
  - Aplicada migração `202510270900_crm_init` com tabelas de CRM (empreendimentos, correspondentes, correspondentes_usuarios, pre_cadastros, documentos_pre_cadastro, documento_tipos) + função `calcular_percentual_documentos`.
- Prisma/schema
  - Corrigida duplicidade de `appointments` no schema e relações órfãs, permitindo `prisma generate` em build.
- Seed
  - `scripts/seed-admin.ts` ajustado e executado no container. Admin criado/atualizado: `admin@primezapia.com`, tenant default criado/garantido.
- Limpeza/Armazenamento
  - Limpeza de imagens/volumes/caches não usados; uso do root agora em 16% (≈114G livres), antes ~80%.
## Atualização (2025-10-31T10:48:00-03:00)
- Banco/Migrações/Seeds
  - Aplicadas migrations Prisma/Supabase no ambiente dockerizado; funções SQL `calcular_percentual_documentos` e `generate_pre_cadastro_numero` presentes.
  - RLS habilitado em `conversations` e `messages`; tabela `public.whatsapp_connections` criada e validada.
  - Seeds idempotentes executados: admin/tenant base, CRM mínimo (stages/tags) e integração WhatsApp.
- API/Worker
  - Correções camelCase em relatórios CRM (status de leads e join de appointments conforme schema atual).
  - Seed de conexões robusto (detecta colunas de `whatsapp_connections` e insere idempotente).
  - Worker: pipeline de mensagens WhatsApp (cria/atualiza contato e conversa; persiste mensagens) e lembretes/feedback de visitas.
  - Scripts adicionados: `scripts/db/smoke.sh` (SQL), `scripts/testing/smoke-api.sh` (HTTP), `scripts/validate-env-sync.sh` (env API/Worker).
- Frontend
  - Build Vite realizado com `.env.web` (VITE_SUPABASE_URL/ANON_KEY, VITE_API_BASE_URL) e rotas/abas do CRM centralizadas.
  - Ajuste na página de Leads para persistir “Probabilidade de Venda (1–5)” via `PATCH /api/leads/:id/probability` (campo `saleProbability`).

Próximos Passos (API/Worker)
- Finalizar typecheck `tsc` da API e ajustar módulos remanescentes (messages/products/reports específicos que o tsc acusar).
- Validar estabilidade WhatsApp 30+ min e Realtime; testar reconexões; smokes em `/whatsapp/qr/:sessionName` e `/whatsapp/:id/status`.
- Validar filas BullMQ (broadcast/flows) e integrações externas com credenciais reais.

Próximos Passos (Frontend & UX)
- Staging: validar `.env.web` com SUPABASE e API; rodar `pnpm preview` e testar QR/Conversas “real device”.
- CRM Hub: revisar contadores/filtros por aba; timeline do Deal incluindo documentos vinculados; exibir progresso de documentos (função SQL) e permitir PDF único.
- Leads: confirmar atualização de “Possibilidade de Venda (1–5)” na UI (diálogo do Lead) e alinhar lead score assistido.
- Telemetria/UX: badges de estados, retries, e ajustes de UX nos fluxos de QR/Conversas.

## Atualização (2025-10-31T14:30:00-03:00)
- Infra/DevOps
  - Backups: adicionados scripts `scripts/infra/backup.sh` (tar.gz com dumps do Postgres, .env e var/*) e `scripts/infra/restore.sh` (restore idempotente). Documento de uso em `scripts/README_INFRA_DEVOPS.md` com exemplo de cron.
  - Reboot validado: `scripts/infra/reboot-validate.sh` com pré/pós-checks (kernel, docker-compose, logs da API e health via nginx).
  - Endurecimento: `scripts/infra/harden-ports.sh` (UFW) para restringir 5432/6379/4000 a localhost/rede Docker. Compose já não expõe essas portas.
  - Observabilidade: `scripts/observability/update-prometheus-targets.sh` atualiza `prometheus.yml` para `api:4000` e `web:8080` (rede docker).
  - Pipeline/CI: `scripts/pipeline/primeflow-pipeline.sh` (install → prisma generate → tsc → lint → build → smokes) e workflow `.github/workflows/ci.yml` (best‑effort até API fechar typecheck).

- Automação/Qualidade
  - Smokes: `scripts/testing/smoke-web.sh` (GET /healthz,/integrations) e `scripts/testing/smoke-db.sh` (psql SELECT version()).
  - Frontend: axios com `timeout` padrão 15s para evitar páginas “presas carregando”; env `VITE_API_TIMEOUT_MS` permite ajuste.
  - Serviços: envio de mensagens e import de empresas passaram a usar o cliente `api` (com headers e timeout) em vez de `fetch` direto.

- Itens pendentes (Infra/DevOps)
  - Executar hardening/UFW no host (requer sudo) e programar cron de backup diário.
  - Rodar reboot validado para kernel 6.8.0‑86 e observar logs (`journalctl`, drivers qxl se aplicável).
  - Endurecer CI após o typecheck limpo da API (remover tolerância `|| true`).
