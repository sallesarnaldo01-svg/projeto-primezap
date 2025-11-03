Primeflow – Infra/DevOps Toolkit
================================

Este diretório contém automações para backup/reboot/endurecimento, pipeline unificado e observabilidade.

Backups e Restore
-----------------
- `scripts/infra/backup.sh` (gera tar.gz com dumps do Postgres, .env e var/*)
  - Ex.: `./scripts/infra/backup.sh --output /root/backups`
  - Variáveis: `DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DOCKER_SERVICE_POSTGRES`
- `scripts/infra/restore.sh` (restaura .env/var e dump do Postgres)
  - Ex.: `./scripts/infra/restore.sh /root/backups/primeflow_backup_YYYYMMDD_HHMMSS.tar.gz`

Reboot Planejado
----------------
- `scripts/infra/reboot-validate.sh`
  - Pré-reboot: `./scripts/infra/reboot-validate.sh pre`
  - Pós-reboot: `./scripts/infra/reboot-validate.sh post`

Endurecimento de Portas
-----------------------
- `scripts/infra/harden-ports.sh` (UFW + verificação do compose)
  - Restringe 5432/6379/4000 a localhost/rede Docker; mantém 22/80/443/(HTTP_PORT/HTTPS_PORT) liberadas.

Pipeline Unificado / CI Local
-----------------------------
- `scripts/pipeline/primeflow-pipeline.sh`
  - Instala deps, roda prisma generate, typecheck (web/api), lint, build e smokes.
  - Ideal para rodar antes de abrir PR/deploy.

Observabilidade
---------------
- `scripts/observability/update-prometheus-targets.sh`
  - Atualiza `prometheus.yml` para usar `api:4000` e `web:8080` (rede Docker) ao invés de `host.docker.internal`.
- `prometheus.yml`/`alerts.yml`
  - Ajuste targets/alertas conforme ambiente e exporters disponíveis.

Smokes
------
- `scripts/testing/smoke-web.sh`: GET healthz e endpoints públicos básicos.
- `scripts/testing/smoke-db.sh`: Teste de conexão ao Postgres.

Cron (exemplo)
--------------
Adicione uma entrada no crontab para backup diário às 03:10:

```
10 3 * * * /bin/bash /home/administrator/scripts/infra/backup.sh --output /home/administrator/backups >> /var/log/primeflow-backup.log 2>&1
```

