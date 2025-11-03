# Consolidação dos Planos de Ação

**Data:** 03/11/2025  
**Status:** Em execução

## Análise dos Planos Anteriores vs Plano Atual

### Plano Anterior (oquefoifeito.zip)

O plano anterior estava focado em:

1. **Refatoração camelCase do Schema Prisma** - Conversão de snake_case para camelCase com `@map`/`@@map`
2. **Correção de ~40 erros TypeScript** - Principalmente relacionados a campos snake vs camel
3. **Problema Crítico do WhatsApp QR Code** - Fluxo quebrado entre frontend → API → Worker
4. **Problema de Mensagens em Conversas** - Divergência de DATABASE_URL entre worker e frontend
5. **Migrations e Seeds** - Pendente após build limpo

### Plano Atual (Meu Diagnóstico)

Meu diagnóstico identificou os mesmos problemas, mas com uma abordagem mais estruturada:

**Fase 0 - Unificação e Limpeza (CONCLUÍDA):**
- ✓ Backup de segurança criado
- ✓ Fonte da verdade definida (código atual na raiz)
- ✓ 31 itens legados movidos para `_legacy_artifacts/`
- ✓ `.env.example` criado
- ✓ `.gitignore` atualizado

**Fase 1 - Estabilização (EM ANDAMENTO):**
- ✓ Fase 1.1: DATABASE_URL unificada (removido docker-compose.override.yml)
- ⏳ Fase 1.2: Corrigir build TypeScript (160 erros identificados)
- ⏳ Fase 1.3: Unificar schema e migrations
- ⏳ Fase 1.4: Corrigir fluxos WhatsApp

## Alinhamento e Próximos Passos

### O que já foi feito (pelo plano anterior):

Segundo os relatórios:
- Refatoração parcial de controllers (companies, contacts, deals, tags, custom_fields)
- Implementação de helper `signJwt` compartilhado
- Consolidação de client HTTP com JWT+`x-tenant-id`
- Reescrita de `whatsapp.ts` service
- Alinhamento do worker com Prisma/Redis

### O que precisa ser feito (continuação):

1. **IMEDIATO - Compilar pacote @primeflow/shared**
   - Problema: 25 erros TS6305 porque o pacote não está compilado
   - Ação: Corrigir tsconfig e compilar o pacote

2. **CRÍTICO - Corrigir 127 erros de tipo `unknown`**
   - Problema: Falta de tipagem em `req.user` e `req.params`
   - Ação: Adicionar tipos adequados no middleware de autenticação

3. **ALTO - Completar refatoração camelCase**
   - Problema: Alguns controllers ainda usam snake_case
   - Ação: Revisar e corrigir controllers pendentes

4. **ALTO - Corrigir fluxo WhatsApp QR Code**
   - Problema: Frontend não chama `/api/whatsapp/initiate`
   - Ação: Refatorar `Conexoes.tsx` e `whatsapp.ts`

5. **MÉDIO - Unificar migrations**
   - Problema: Migrations fragmentadas e patches SQL manuais
   - Ação: Consolidar em uma migration inicial limpa

## Decisão Estratégica

**CONTINUAR COM O PLANO ATUAL**, pois:

1. A Fase 0 (Unificação) já organizou o projeto significativamente
2. O diagnóstico atual é mais abrangente e estruturado
3. Os problemas identificados são os mesmos, mas a abordagem é mais metódica
4. O backup de segurança garante que podemos reverter se necessário

**INCORPORAR OS APRENDIZADOS DO PLANO ANTERIOR:**
- Usar os controllers já refatorados como referência
- Aproveitar o helper `signJwt` já implementado
- Seguir a estrutura de client HTTP já consolidada
- Manter os ajustes de CORS e health checks já feitos

## Status Atual da Execução

### Fase 0: ✅ CONCLUÍDA
- Backup, limpeza, organização e gerenciamento de segredos

### Fase 1: 🔄 EM ANDAMENTO
- ✅ Fase 1.1: DATABASE_URL resolvida
- ⏳ Fase 1.2: Build TypeScript (160 erros identificados, iniciando correções)
- ⏳ Fase 1.3: Schema e migrations (pendente)
- ⏳ Fase 1.4: Fluxos WhatsApp (pendente)

## Próxima Ação Imediata

Continuar na **Fase 1.2** corrigindo os erros de build TypeScript na seguinte ordem:

1. Compilar pacote `@primeflow/shared` (resolve 25 erros)
2. Adicionar tipagem adequada para `req.user` e `req.params` (resolve 127 erros)
3. Revisar controllers pendentes de refatoração camelCase
4. Executar novo build e validar resultado
