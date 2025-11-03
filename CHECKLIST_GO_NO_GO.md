# Go/No-Go Checklist

- Builds
  - [ ] API typecheck passes (`apps/api`)
  - [ ] Worker typecheck passes (`apps/worker`)
  - [ ] Prisma validate passes
  - [ ] Docker images build for api/worker/frontend
- WhatsApp flow
  - [ ] Initiate connection publishes to worker
  - [ ] QR polling returns 204 → 200 as QR becomes available
  - [ ] Connection reaches CONNECTED and persists
  - [ ] Messages create/update `conversations` and `messages`
  - [ ] Realtime events reach frontend
- Modules
  - [ ] tags stable
  - [ ] tickets basic CRUD/stats stable
  - [ ] users routes enabled and secured
  - [ ] scrum enabled (post-staging)
  - [ ] video-call enabled (post-staging)
- DB & Supabase
  - [ ] Supabase migrations applied (whatsapp_connections, RLS)
  - [ ] Seeds run (admin + connections)
  - [ ] DATABASE_URL unified in API/Worker
  - [ ] REDIS config unified
- Monitoring & Ops
  - [ ] Prometheus scraping API/infra
  - [ ] Backups run and include Supabase artifacts
  - [ ] Host rebooted to new kernel and services validated

