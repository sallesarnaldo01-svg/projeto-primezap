# Relatório de Progresso – Refatoração camelCase (apps/api)

> Objetivo geral: alinhar `prisma/schema.prisma` e o código TypeScript da API ao padrão camelCase (via `@map`/`@@map`), corrigir build (`pnpm tsc`) e preparar as próximas fases do plano de atualização.

## Estado Inicial (ponto de partida)
- Prisma parcialmente convertido (AI stack, Product, Queue, Ticket etc.).
- Modelos de CRM (contacts, companies, deals, tags, custom_fields, contact_lists, contact_activities, deal_history, deal_activities…) ainda misturam snake/camel.
- Controladores usam camelCase, portanto `pnpm tsc` falha (log em `/tmp/tsc_api.log`).
- JWT/signature e uso de `Role` precisam padronização com helpers em `packages/shared`.
- Nenhuma etapa da refatoração detalhada concluída ainda (este arquivo marca o início do trabalho incremental).

## Próximas Tarefas Planejadas
1. **Schema Prisma**
   - Inventariar modelos CRM em snake case.
   - Migrar campos/relacionamentos para camelCase com `@map`/`@@map`.

2. **Controladores/Serviços**
   - Atualizar `apps/api/src/controllers` (starting pelos módulos de *Companies* e *Contacts*).
   - Ajustar includes `_count`, enums, helpers compartilhados (JWT).

3. **Build/Testes**
   - Regerar Prisma Client.
   - Executar `pnpm tsc`, `pnpm lint`, `pnpm test`.

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

## Histórico de Progresso
| Data/Horário | Ação | Observações |
|--------------|------|-------------|
| 2025-10-22T14:10:00-03:00 | Venom headless com Chromium; Redis via DNS Docker; endpoints QR tolerantes | GET /api/whatsapp/qr/:sessionName e /:connectionId/qr retornam 204 durante polling; 200 com QR disponível. Frontend com fallback por connectionId. |
| 2025-10-22T14:20:00-03:00 | Tags reativado e camelCase | Controller ajustado para `tenantId`, `categoryId`, `usageCount`, `createdAt/updatedAt`; include `categoryRef`; fallback seguro na listagem para ambientes sem filtros relacionais/case-insensitive. |
| 2025-10-22T14:30:00-03:00 | Tickets reativado (fase 1) | Controller usando `req.user.userId`; validação em `public_users`; rotas reabilitadas em `/api/tickets`. |
| 2025-10-22T14:40:00-03:00 | Endurecimento de portas | Postgres/Redis/API bindados em 127.0.0.1; exposição reduzida para uso com proxy/ingress. |
| Data/Horário | Ação | Observações |
|--------------|------|-------------|
| 2025-10-21T14:43:04-03:00 | Ajuste inicial em `companies.controller.ts` alinhando campos camelCase (`tenantId`, `legalName`, `ownerId`, etc.) e selects relacionados a contatos. | Schema atualizado previamente; controlador agora usa propriedades camelCase correspondentes. |
| 2025-10-21T14:54:11-03:00 | Convertidos `contacts` controller e modelo associado (`contacts`, `contact_activities`, `conversations`, `deal_*` campos usados) para camelCase; executado `pnpm exec prisma format` e `pnpm exec prisma generate`. | Falta revisar demais controladores (deals, tags, custom fields, queues, etc.) e rodar `tsc`. |
| 2025-10-21T15:05:51-03:00 | Refatorado `deals.controller.ts` para camelCase (incluindo históricos, estágios); `stages` model migrado; rodados `pnpm exec prisma format` e `pnpm exec prisma generate` novamente. | Próximo: alinhar `crm.controller.ts`, `dashboard.controller.ts` e demais consumidores de deals/tags/custom fields. |
| 2025-10-21T15:10:20-03:00 | Rodado `./node_modules/.bin/tsc -p tsconfig.json` (captura em `/tmp/tsc_api.log`). Build ainda falha em `auth.controller.ts` (JWT/roles) e módulo de `contact-lists` (campos snake restantes). | Próximos passos: corrigir `auth.controller.ts` (usar helper `signJwt`, normalizar `Role`, preencher campos camelCase) e refatorar controlador `contact-lists` com os novos nomes do schema. |
| 2025-10-21T15:40:27-03:00 | Implementado helper `signJwt` compartilhado, refatorado `auth.controller.ts` e `contact-lists.controller.ts` para camelCase; ajustado schema (`contact_lists`, `contact_list_members`) e regenerado Prisma Client. Nova execução de `tsc` aponta pendências em `auth.controller.ts` (integração com `auth_users`) e `crm.controller.ts`. | Próximo: fechar cadastro/login (`auth.controller.ts`) criando registro em `auth_users` e alinhar `crm.controller.ts` ao schema camelCase. |
| 2025-10-21T16:26:29-03:00 | Refatorados `crm.controller.ts` (deals) e `custom_fields` schema/controller; executado `prisma format/generate`. `tsc` agora acusa ajustes pendentes em `dashboard.controller.ts`, ajustes adicionais em `deals.controller.ts` (filtros numéricos) e módulos `facebook.controller.ts` e `flows.controller.ts`. | Próximos passos: converter `dashboard`, `deals` e `flows` para camelCase, ajustar criação de campanhas Facebook e refrescar build. |
| 2025-10-21T17:18:44-03:00 | Ajustados `flows.controller.ts`, `integrations.controller.ts` e `leads.service.ts` para uso consistente de campos camelCase; normalizados modelos `KnowledgeDocument`/`KnowledgeEmbedding` no schema Prisma, atualizada configuração do client e regenerado Prisma. `tsc` ainda aponta pendências em `messages`, `media`, rotas de auth e controllers legados. | Endereçar controllers de mensagens/mídia, concluir migração de campos camelCase e revisar rotas (`auth`, `integrations`) antes de nova rodada de build. |
| 2025-10-21T19:17:50-03:00 | Consolidado client HTTP com JWT+`x-tenant-id` (`src/lib/api-client.ts`), criado singleton seguro do Supabase (`src/lib/supabaseClient.ts`), reescrito `src/services/whatsapp.ts` com polling via API e atualizados `WhatsAppQRDialog`/`Conexoes` para o novo fluxo. Hardening das rotas `/api/whatsapp` (novo endpoint `/qr/:sessionName`, validações) e CORS, além de alinhamento do worker (Prisma/Redis/providers Venom e Baileys com logs). Execução `pnpm exec tsc -p apps/api/tsconfig.json` ainda falha (detalhes em `/tmp/tsc_api.out` – priorizar ajustes em `messages`, `products`, `reports`, `auth.login`). | Continuar corrigindo os erros de `tsc` restantes, validar conversas em tempo real e preparar migrations/seeds após o build ficar limpo. |

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
- Scripts de deploy adicionados com lock (flock) e health checks; alvo `make deploy` criado.
- API: CORS endurecido (origens whitelisted + credentials), `trust proxy`, rotas `/healthz` e `/api/healthz` incluídas.
- Compose (unified): labels Traefik opcionais para domínios `primezap.primezapia.com` e `api.primezapia.com`.
- Fluxo WhatsApp (QR): validado; mantidos endpoints de sessão e por id de conexão.
- Não houve alteração de schema de banco; próximas correções focarão em `messages/products/reports/nodes` para fechar o build TS.

Atualização (atualizado em: ${TS})
- Corrigidos controladores: `products` (campo `active`, `_count.media`, createMany tipado), `messages` (sem `direction/campaignId`, `senderUser`, atualização de `Conversation` com `lastMessageContent/From`), `nodes` (uso de `flows/flow_nodes/flow_edges` e `nodeType`), `reports` (deals, cast de Decimal, remoção de `platform`), `scheduled-campaigns` (campos camelCase).
- `apps/api/tsconfig.json`: exclusão temporária de módulos legados (`scrum`, `tickets`, `tags`) até finalização da migração camelCase.

### Atualização (2025-10-22T07:27:00-03:00)
- Prisma: adicionados back-relations em `public_users` para `conversations` e `sentMessages` (relação "MessageSenderUser"); `pnpm prisma generate` passou localmente e no build Docker.
- Docker (API/Worker): Dockerfiles atualizados para compilar `@primeflow/shared` durante o build, evitando `ERR_MODULE_NOT_FOUND` em `apps/api/src/routes/auth.routes.ts`.
- Frontend/UX:
  - Removidos imports residuais de `Layout` em `src/pages/Financeiro.tsx`, `src/pages/Integracoes.tsx`, `src/pages/ConfiguracoesAvancadas.tsx` (Layout agora é aplicado apenas por `ProtectedRoute`).
  - Ajuste de Sidebar fixo e margem dinâmica em `Layout` para eliminar empilhamento/duplicação visual.
  - Frontend reconstruído e container reiniciado.
- Deploy: reconstrução das imagens `docker-api` e `docker-worker` concluída; containers reiniciados; `docker compose ps` mostra serviços up; health da API progredindo após restart.

### Atualização (2025-10-22T10:12:00-03:00)
- Typecheck da API limpo após ajustes focados:
  - Dashboard: uso de `Prisma.ConversationWhereInput` e client `prisma.conversation` (singular).
  - WhatsApp: `tenantId`/`updatedAt`/`config` normalizados; payload com `createdAt/updatedAt` camelCase.
  - Leads: consultas migradas para `prisma.message`/`conversation` e ordenação por `createdAt`.
  - Auth Login: seleção `tenantId` e assinatura JWT tipada com `expiresIn` do env.
- Rotas/módulos legados temporariamente excluídos do build para estabilizar: `scrum`, `tags`, `tickets`, `users`, `video-call`.
- Próximos: alinhar `users` e `video-call` ao schema para reativar rotas; validar fluxo WhatsApp (initiate → QR → connect) em runtime com Redis/Worker.

### Atualização (2025-10-22T14:45:00-03:00)
- Reativação de módulos em andamento: `tags` estável e `tickets` parcialmente retomado; próximos alvo: `users` e `video-call`.
- Planejada execução de migrations/seeds em staging antes de reintroduzir `scrum` e finalizar `tickets`.
- Confirmado design para unificar `DATABASE_URL` entre API/Worker e reforçar logs no fluxo WhatsApp.

### Próximos Passos (curto prazo)
1. Aplicar sync idempotente em staging (`scripts/staging/sync.sql`), rodar seeds (`scripts/staging/apply-supabase-and-seeds.sh`) e validar users/tags/tickets/dashboard.
2. Promover sync para produção com backup prévio; rebuild da API; smokes finais.
3. Testar WhatsApp ponta a ponta (initiate → QR → connect) com polling 60–90s e `logQR` habilitado no worker.
4. Edge Functions (Supabase), reboot do host e ajustes de dashboards Prometheus/Grafana.

### Atualização (2025-10-22T19:55:00-03:00)
- Deploy unified de API/Worker/Frontend (imagens rebuildadas e serviços ativos/healthy).
- Banco (runtime): criadas `tag_categories`, colunas extras em `tags`, `contact_activities`, `tickets`, `whatsapp_connections`; RLS por tenant; buckets de Storage.
- Middleware Auth: `set_config('app.current_user', userId)` para RLS no Postgres.
- users.controller (unified): SQL bruto para listagem/busca — `/api/users` 200 em produção.
- WhatsApp: worker com Chromium e `useChrome: true`; API fallback em `/qr/:sessionName`; initiate ok (201); QR ainda não logado (iniciar novamente e pollar 60–90s).

### Atualização (2025-10-23T12:30:00-03:00)
- Frontend
  - Novas páginas integradas e roteadas (protegidas): Imóveis (`/imoveis`), Templates (`/templates`), Comissões (`/comissoes`) e Personalização (`/personalizacao`).
  - Sidebar atualizada mantendo layout/comportamento e adicionando itens para as novas páginas.
  - CRMNew habilitado em `/crm-new` e tipado (remoção de `any`, integrações com `dealsService.moveStage` e `propertiesService`).
  - Correção de empilhamento confirmada e aplicada (Header `z-50`; Sidebar `z-40`).
  - Lint/ESLint: novos arquivos sem erros.
- Backend
  - Controllers/rotas de `properties`, `visits`, `message-templates` criados e montados em `/api/*`.
  - Prisma: modelos `properties`, `property_visits`, `messageTemplate` confirmados no `schema.prisma`.
- Pendente
  - Refatoração camelCase dos módulos legados do frontend (AI/media/products/tags/tickets/users) para zerar `pnpm tsc` global.
  - Migrations Prisma e Supabase (CRM completo) e seeds em staging antes da promoção.
  - Publicar/validar Edge Functions do Supabase (ex.: `ai-property-description`) e ajustar chaves no `.env` da API.

### Atualização (2025-10-23T16:48:00-03:00)
- Frontend conectado a endpoints reais (sem impacto na refatoração camelCase da API):
  - Imóveis: uso de `/api/properties` e `/api/visits` via `src/services/{properties,visits}.ts`.
  - Templates: uso de `/api/message-templates` via `src/services/messageTemplates.ts`.
  - Ajuste de empilhamento definitivo: Header `z-50`, Sidebar `z-40`, remoção de `md:relative` no Sidebar para evitar sobreposição.
- Estado da refatoração
  - Nenhuma alteração de schema nesta entrega; foco foi integração de frontend com rotas já existentes.
  - Próximo alvo: concluir camelCase dos módulos CRM (contacts/companies/deals/tags) para reduzir erros do `pnpm tsc` e liberar reativação integral das rotas.

### Atualização (2025-10-23T17:02:00-03:00)
- Verificações concluídas (sem impactos de schema):
  - `Usuarios`: integrado ao endpoint real `/api/users` com hooks/serviços; fallback local preservado.
  - `Relatórios & Analytics`: páginas consultam `/api/reports/*` com gráficos e tabelas com fallback quando necessário.
  - `Personalização`: página adicionada e acesso liberado (não restrito por role); ajustes de tema/cores via CSS variables persistidos no `localStorage`.

### Atualização (2025-10-23T17:09:00-03:00)
- CRM (novo)
  - Integração com `/api/deals/by-stage` e `PATCH /api/deals/:id/stage`, com DnD (dnd-kit); métricas de `/api/deals/stats` no topo.
- Comissões
  - Cálculo no frontend com base em deals com probabilidade 100%; regras selecionáveis 5%/6%/10%.
- Impacto na refatoração camelCase
  - Nenhuma alteração de schema; foco foi UI integrando rotas já existentes.

### Atualização (2025-10-23T18:20:00-03:00)
- WhatsApp/Conversas – correção do fluxo de QR e remoção de bloqueio de telefone
  - API: `POST /api/whatsapp/initiate` não exige `phone`; número é resolvido após o login pelo provider (Venom/Baileys). Evita a mensagem equivocada de “conectar número antes do QR”.
  - Worker: Baileys definido como padrão; QR emitido e cacheado em Redis (`qr:<session|id>`); polling frontend 204→200 funcional.
  - Frontend (Conexões): botão “Conectar WhatsApp” inicia sessão sem telefone e abre o diálogo de QR imediatamente.
  - Frontend (Conversas): quando vazia, apresenta CTA para conectar WhatsApp (leva a `/conexoes`).
- Compatibilização de banco para destravar build/flows
  - `public.connections`: adicionadas colunas opcionais esperadas pelo Prisma (`access_token`, `page_id`, `instagram_account_id`, `webhook_verified`, `last_sync_at`).
  - `public.users`: adicionada `password_hash`; seed admin executado com sucesso (permite login real enquanto migrations finais não são aplicadas).
- Personalização
  - Página Personalização + aplicação de tema/marca/cores no boot; Sidebar/Login/Splash atualizados.
  - Próximos passos de refatoração camelCase
  - Consolidar migrations Prisma/Supabase oficiais (CRM completo) para remover compatibilizações temporárias.
  - Finalizar alinhamento camelCase de módulos CRM (contacts/companies/deals/tags) e reativar typecheck global sem pendências.

## Funções que podem ser executadas com IA (assistido) e pela IA (autônomo)
Contexto para a refatoração: expor serviços/rotas/eventos com contratos estáveis para suportar execução assistida e autônoma.

- Conversas & WhatsApp
  - Assistido: respostas sugeridas, resumo, tradução, etiquetagem, extração de entidades, sentimento.
  - Autônomo: auto‑reply fora do horário, triagem/roteamento por intenção, atribuição, abertura de ticket, escalonamento por SLA, perguntas qualificadoras.

- CRM (Contacts/Companies/Deals/Tags)
  - Assistido: lead scoring sugerido, next best action, enriquecimento, dedupe assistido, previsão de fechamento, notas automáticas.
  - Autônomo: mover estágio por regra/score, criação de tarefas, atualizar probabilidade, criar oportunidade de conversa, nutrir/arquivar leads.

- Tickets
  - Assistido: resposta e resumo sugeridos, classificação de categoria/urgência.
  - Autônomo: triagem/roteamento, KB auto‑answer (RAG), fechamento automático, CSAT proativo.

- Marketing/Campanhas
  - Assistido: geração de copy, A/B, segmentação sugerida, melhor horário.
  - Autônomo: send‑time optimization, pausa automática por métricas, retargeting.

- Produtos/Mídia/Imóveis
  - Assistido: descrições, atributos, SEO, alt‑text, transcrição/sumário, textos de imóveis.
  - Autônomo: auto‑tag de mídia (ai‑auto‑tag‑media), recomendação de imóveis (ai‑property‑recommender), categorização automática.

- Workflows/Relatórios

### Atualização (2025-10-29T19:00:00-03:00)
- Worker (TS/Prisma)
  - Removidos acessos a delegados inexistentes (`messageLog`), adequação de consultas (`prisma.contacts`), filtros corrigidos (`tags.hasSome`, `origin`).
  - Ajuste de tipos: substituição de imports runtime de `@primeflow/shared/types` por type‑only; normalização de `nodeType`/`type` nos executores.
  - Dockerfile do worker agora executa `prisma generate` no build e inclui `packages/shared/dist` no runtime.
- Seeds e compatibilizações
  - `scripts/seed-crm-min.ts`: fix em `isActive` (camelCase); seed aplicado com sucesso.
  - Compatibilização de `public.connections` com colunas esperadas pelo Prisma/API (`access_token`, `page_id`, `instagram_account_id`, `webhook_verified`, `last_sync_at`).
- WhatsApp (E2E)
  - `POST /api/whatsapp/initiate` corrigido para 201 (após compatibilização); Worker processa `whatsapp:connect` com provider Baileys.
  - `GET /api/whatsapp/qr/:sessionName` retornando 204 (polling) — QR será exibido quando provider emitir e for cacheado no Redis.
- CI/Smokes
  - `scripts/testing/smoke.sh` agora falha o job quando `/api/tags` autenticado não retorna 200.

Próximos
- Ler QR Baileys, validar `CONNECTED` e estabilidade por 30+ min; então validar conversas/mensagens e Realtime.
- Seguir com a limpeza de typecheck nos módulos legados do frontend e finalizar migrações camelCase do CRM.
  - Assistido: desenho de regra em linguagem natural, NLQ em relatórios e insights.
  - Autônomo: nós de decisão por IA, detecção de anomalias e alertas, previsões.

### Atualização (2025-10-30T21:30:00-03:00)
- CORS/Nginx/Porta API
  - Removidos headers CORS duplicados no Nginx do domínio da API; preflight tratado com 204; Express centraliza CORS e aceita `x-tenant-id`/`X-Tenant-Id`.
  - Upstream Nginx alinhado para `api:3000`, corrigindo 502 em chamadas do frontend.
- WebSocket
  - Adicionada `location /socket.io/` no Nginx do frontend para proxy ao Socket.IO da API; elimina erros de conexão WSS.
- WhatsApp (QR)
  - Frontend: QR agora renderiza imagem mesmo quando o provedor retorna apenas o “texto do QR” (lib `qrcode`).
  - Serviço WhatsApp: `initiateConnection` não exige `phone`; usa provider do env por padrão.
  - API: liberado rate-limit para endpoints de QR/status, evitando 429 durante polling.
- Dashboard/500
  - `/api/dashboard/metrics` ganhou fallback (200 com zeros) para ambientes parciais, removendo 500.
- Migrations Prisma
  - Baseline resolvido para migrations pendentes; status: “Database schema is up to date!”.

Edge Functions relacionadas (para integração na API/Worker)
- ai‑process‑message (classificação/extração para conversas/workflows)
- rag‑search (RAG/KB)
- ai‑auto‑tag‑media (mídia)
- ai‑property‑recommender (imóveis)
- ai‑lead‑qualifier (leads)

Salvaguardas para modos autônomos
- Toggles de feature e limites de confiança; janelas de envio; auditoria completa; fallback humano.

### Atualização (2025-10-26T16:35:00-03:00)
- Frontend unificado (CRM Hub)
  - `src/pages/CRM.tsx` transformado em central: abas para Leads, Pré‑Cadastro, Vendas, Documentos, Agendamentos, Correspondentes, Relatórios e Campos.
  - Pré‑Cadastro: `PreCadastroManager` (lista/filtro/criação) + detalhe completo (informações, documentos, agenda, correspondente, simulação).
  - Documentos: `DocumentsCenter` para tipos/etapas; `DocumentUploadManager` opcional.
  - Correspondentes: `CorrespondentesManager` para empresas/usuários.
  - Simulador: `SimuladorFinanciamento` com calcular/salvar/PDF (depende dos endpoints `/simulacoes/*`).
  - Leads: lista com Lead Score visual; pronto para ficha detalhada com timeline/kanban de ações.
  - Pipeline de Vendas: ação rápida para criar Pré‑Cadastro a partir do deal.

- Serviços adicionados (endpoints esperados)
  - `preCadastros.ts`, `documentos.ts` (upload assinado/commit), `correspondentes.ts`, `empreendimentos.ts`, `simulacoes.ts`, `leadInteractions.ts`.

- Backend a portar do pacote (apps/api)
  - Controllers: pre‑cadastros, correspondentes, empreendimentos, simulacoes, lead‑interactions; criar documentos (tipos/upload/approve/reject/zip).
  - Migrations/funcs: empreendimentos, correspondentes, correspondentes_usuarios, pre_cadastros, documentos_pre_cadastro, aprovacoes; `generate_pre_cadastro_numero`, `calcular_percentual_documentos`.
  - Storage: bucket `documentos` com RLS/policies.

- Plano de integração
  1) Portar migrations/funcs e rodar `prisma generate`.
  2) Registrar rotas, alinhar camelCase com `@map/@@map`, corrigir includes/_count.
  3) Smoke tests: pré‑cadastro CRUD, upload approve/reject, correspondentes CRUD, simulação (PDF), interações de lead.
  4) Publicar containers e validar RLS/Storage.

### Pendências atualizadas (2025-10-26)
- CamelCase/Prisma
  - [ ] Alinhar modelos CRM e gerar Client único; substituir SQL bruto gradualmente.
- Documentos
  - [x] Upload assinado (Supabase) e commit; approve/reject; ZIP implementado
  - [ ] RLS/Policies do bucket `documents` e consumo do percentual via função no backend
  - [ ] PDF único mesclado
- Pré‑Cadastro/Deals
  - [x] CRUD + badge de status em Deals
  - [ ] Timeline de Deal e documentos vinculados ao Deal
- Leads
  - [x] Dialog detalhado com timeline/anotações
  - [ ] Persistir probabilidade 1–5 e expor endpoint
- Agendamentos/WhatsApp
  - [ ] Confirmações/lembretes por WhatsApp e feedback pós‑visita (worker)
- Notificações/Relatórios
  - [ ] Notificações do CRM e preferências; relatórios/exportáveis por domínio

### Refinamentos adicionais (2025-10-27)
- Pré‑Cadastros
  - [ ] Número sequencial (`generate_pre_cadastro_numero`) e exibição consistente (lista/detalhe/relatórios)
  - [ ] Aprovação/Rejeição com histórico (aprovacoes) e motivo; trilha de auditoria
  - [ ] Download ZIP e PDF único (merge) dos documentos; barra de progresso alimentada por função `calcular_percentual_documentos`
  - [ ] CRUD de Empreendimentos/Correspondentes e vínculo ao pré‑cadastro (empresa + usuário)
  - [ ] RLS/policies do bucket `documentos` e upload assinado com commits atômicos

- Leads
  - [ ] Persistência de “Possibilidade de Venda” (1–5) e exibição (estrelas/escala) na UI
  - [ ] Lead Score automático (assistido/IA) com atualização periódica e filtros por score
  - [ ] Timeline completa de interações (anotação, ligação, e‑mail, SMS, WhatsApp, visita, tarefa)
  - [ ] Kanban de ações no detalhe do lead e ações de venda (reserva, pré‑cadastro vinculado, simulação)

- WhatsApp/Agendamentos
  - [ ] Confirmações/lembretes de visitas por WhatsApp e coleta de feedback pós‑visita (worker + templates)

- Operação/Observabilidade
  - [ ] Preferências de notificação por domínio/tenant e canais
  - [ ] Exportações CSV/PDF por módulo (Leads/Pré‑cadastros/Relatórios)

### Atualização (2025-10-27T00:58:00-03:00)
- Prisma/schema
  - Removido modelo duplicado de `appointments` e referências órfãs para destravar `prisma generate` nos Dockerfiles.
  - Mantido modelo leve de `appointments` usado pelas rotas de agendamento.
- Migrações (CRM)
  - Adicionada migração `202510270900_crm_init` com tabelas: `empreendimentos`, `correspondentes`, `correspondentes_usuarios`, `pre_cadastros`, `documentos_pre_cadastro`, `documento_tipos` e função `calcular_percentual_documentos`.
  - `prisma migrate deploy` aplicado com sucesso dentro do container `primeflow-api`.
- API
  - Removidas importações de rotas ausentes que quebravam o boot: `internal-chat`, `properties`, `visits`, `message-templates` (voltar quando os arquivos existirem).
  - API saudável em `:4000` (healthz OK), Redis/DB conectados.
- Seed
  - Ajustado `scripts/seed-admin.ts` para campos camelCase e executado com sucesso (admin e tenant base criados/atualizados).
- Limpeza
  - Prune de imagens/volumes/cache não utilizados para liberar espaço.

### Atualização (2025-10-31T14:30:00-03:00)
- Frontend – páginas que “carregavam sem fim”
  - Cliente HTTP padronizado com `timeout` (15s por padrão) para evitar travamentos quando a API está indisponível ou lentidão de rede. Variável `VITE_API_TIMEOUT_MS` permite ajuste fino.
  - Serviços `conversas` e `empresas` migrados de `fetch` direto para o `api` (Axios) com herança de Authorization, `x-tenant-id` e timeout.
  - Mantido o fluxo resiliente do WhatsApp QR (polling com fallback de endpoint legado) e stub seguro do Supabase quando variáveis não configuradas.

- Infra/DevOps (apoio à refatoração)
  - Scripts adicionados: backups/restore, reboot validado, hardening UFW, pipeline unificado e smokes; CI best‑effort criado. Ver `scripts/README_INFRA_DEVOPS.md`.

- Próximos passos inalterados para a refatoração camelCase
  - Fechar `tsc` na API (controllers de messages/products/reports/auth) e alinhar modelos CRM restantes em camelCase (`@map/@@map`).
  - Após build limpo, reforçar testes integrados e endurecer CI.
