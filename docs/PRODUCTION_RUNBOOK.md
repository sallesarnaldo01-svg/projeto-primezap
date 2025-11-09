# PrimeZap Production Runbook (2025-11)

Este runbook consolida o plano de deploy "30 minutos" e incorpora os ajustes
necessários para manter o ambiente sincronizado com o GitHub e Supabase. Use-o
como checklist definitivo para colocar o novo repositório em produção.

---

## 1. Pré-requisitos

- Projeto Supabase ativo (produção) com Realtime habilitado nas tabelas críticas
  (`messages`, `conversations`, `contacts`, `leads`, `deals`, `notifications`).
- VPS Ubuntu 22.04+ com acesso sudo e portas 22/80/443 liberadas.
- Docker Engine >= 24 e plugin `docker compose` >= 2.20.
- Repositório GitHub com branch `main` e GitHub Actions habilitado.
- DNS dos domínios `primezap.primezapia.com` e `api.primezapia.com` apontando
  para o VPS (ou manutenção do apontamento existente durante a migração).

> ⚠️ **Nunca comite credenciais**. Todas as chaves listadas devem permanecer
> apenas nos secrets do GitHub e nos arquivos `.env` do servidor.

---

## 2. Supabase

1. Crie/valide o projeto `primezap-production` no Supabase Dashboard.
2. Gere e copie:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_PROJECT_REF`
   - `SUPABASE_DB_PASSWORD`
3. Gere um Access Token em **Account Settings → Access Tokens** (`github-actions`).
4. Confirme que o arquivo `supabase/config.toml` do repositório aponta para o
   `project_id` correto (ajuste se necessário).

> 💡 O passo 1.4 do plano original (habilitar Realtime) continua obrigatório.

---

## 3. VPS

1. Atualize pacotes e instale `git`, `curl`, `ufw`.
2. Instale Docker com o script oficial e confirme `docker compose version`.
3. Adicione o usuário padrão ao grupo docker (`sudo usermod -aG docker ubuntu`).
4. Crie a árvore `/home/administrator/primezap` e garanta posse do usuário `ubuntu`.
5. Gere uma chave SSH ED25519 exclusiva para puxar o código via GitHub Actions:

```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/github_actions -N ""
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
```

6. Registre a chave **privada** como secret `SSH_PRIVATE_KEY` no GitHub e a
   chave **pública** como deploy key (read-only) no repositório do GitHub.
7. Opcional: configure UFW liberando 22/80/443 e ativando o firewall.

---

## 4. GitHub Secrets (Actions → Secrets and variables → Repository secrets)

| Secret | Descrição |
| ------ | --------- |
| `SSH_HOST` | IP ou hostname do VPS |
| `SSH_PORT` | Porta SSH (default 22) |
| `SSH_USER` | Usuário SSH (ex.: `ubuntu`) |
| `SSH_PRIVATE_KEY` | Conteúdo da chave privada gerada no passo 3 |
| `APP_DIR` | `/home/administrator/primezap` |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de service role |
| `SUPABASE_ACCESS_TOKEN` | Token criado no passo 2 |
| `SUPABASE_PROJECT_REF` | Referência do projeto |
| `SUPABASE_DB_PASSWORD` | Senha do banco Supabase |
| `DATABASE_URL` | Connection string completa (Postgres Supabase) |
| `JWT_SECRET` | `openssl rand -base64 32` |
| `REDIS_URL` | `redis://redis:6379` |
| `REDIS_PASSWORD` | `openssl rand -base64 16` |
| `OPENAI_API_KEY` | opcional |
| `SMTP_*` | opcionais |
| `TELEGRAM_*` | opcionais |
| `TWILIO_*` | opcionais |
| `MAILCHIMP_*` | opcionais |
| `VITE_API_URL` | `https://api.primezapia.com` |

> ✅ Confere com o plano original. Apenas consolide em secrets — não copie as
> chaves para o repositório.

---

## 5. Fluxo CI/CD automatizado

O repositório agora inclui `.github/workflows/deploy.yml`. Toda vez que um push
chegar ao `main` ele executa:

1. **Build & Test** (`pnpm lint`, `pnpm build`, `pnpm build:api`, `pnpm build:worker`).
2. **Migrations Supabase** (`supabase link` + `supabase db push`) usando os
   secrets configurados.
3. **Deploy via SSH**: conecta no VPS, puxa o branch `main`, sincroniza `.env`
   a partir de `.env.production` e executa `docker compose -f docker-compose.prod.yml up -d --build`.

> 🛠️ Para deploy manual/urgente você pode rodar diretamente no servidor:
>
> ```bash
> REPO_URL=git@github.com:<owner>/<repo>.git \
> APP_DIR=/home/administrator/primezap \
> BRANCH=main \
> bash scripts/deploy/deploy-vps.sh
> ```

---

## 6. Cache de páginas legadas (CRM e Configurações de IA)

Antes de publicar a nova versão, capture o HTML das páginas críticas atuais:

```bash
bash scripts/legacy-cache/snapshot-legacy-pages.sh \
  TARGET_DIR=public/legacy-cache \
  LEGACY_BASE_URL=https://primezap.primezapia.com
```

- O script grava `public/legacy-cache/crm.html` e `configuracoes-ia.html`.
- Esses arquivos são empacotados no build Vite (diretório `dist/legacy-cache`).
- O Nginx interno (`nginx/primezap.conf`) expõe `/legacy-cache/` como fallback,
  permitindo recuperar rapidamente as páginas antigas se necessário.

> ℹ️ Se o fetch falhar (ambiente sem internet), execute o script diretamente no
> VPS antes do primeiro deploy para popular o cache.

---

## 7. Pós-deploy

1. Acompanhe o workflow em **GitHub → Actions → Deploy Production**.
2. No VPS, valide serviços: `docker compose -f docker-compose.prod.yml ps`.
3. Health checks:
   - `curl -f https://api.primezapia.com/health`
   - `curl -f https://primezap.primezapia.com`
4. Verifique Supabase (dashboard) para confirmar migrations aplicadas.
5. Acesse `/legacy-cache/crm.html` e `/legacy-cache/configuracoes-ia.html`
   para garantir que os snapshots estejam disponíveis.

---

## 8. Observações finais sobre o plano original

- ✔️ Sequência de criação do projeto Supabase, tokens e habilitação Realtime está
  correta; apenas certifique-se de guardar as chaves em local seguro.
- ✔️ Instalação de Docker/VPS segue as boas práticas — o passo adicional é
  garantir `git` instalado e realizar `ssh-keygen` como descrito.
- ⚠️ Atenção para *não* deixar os valores das chaves expostos em docs ou commits;
  o runbook assume tudo em `Settings → Secrets`.
- ➕ O runbook adiciona automação CI/CD e o cache das páginas legadas, que não
  estavam cobertos inicialmente.

Com tudo configurado, qualquer push para `main` atualizará Supabase e o VPS em
~5 minutos, mantendo o ambiente sincronizado em tempo real.
