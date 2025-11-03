.PHONY: help up down restart logs ps migrate seed build clean preflight dev create-patch apply-patch rollback-patch patch-status

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Start all services
	docker compose -f docker/docker-compose.yml up -d
	@echo "✅ Services started"

down: ## Stop all services
	docker compose -f docker/docker-compose.yml down
	@echo "✅ Services stopped"

restart: ## Restart all services
	docker compose -f docker/docker-compose.yml restart
	@echo "✅ Services restarted"

logs: ## View logs (use SERVICE=api to view specific service)
	@if [ -z "$(SERVICE)" ]; then \
		docker compose -f docker/docker-compose.yml logs -f; \
	else \
		docker compose -f docker/docker-compose.yml logs -f $(SERVICE); \
	fi

ps: ## List running services
	docker compose -f docker/docker-compose.yml ps

migrate: ## Run database migrations
	pnpm prisma migrate deploy
	@echo "✅ Migrations completed"

migrate-dev: ## Create a new migration
	pnpm prisma migrate dev

seed: ## Seed the database
	pnpm seed
	@echo "✅ Database seeded"

build: ## Build the project
	pnpm build
	@echo "✅ Build completed"

build-docker: ## Build Docker images
	docker compose -f docker/docker-compose.yml build
	@echo "✅ Docker images built"

deploy-docker: ## Deploy using root docker-compose (migrate + seed + start)
	bash scripts/deploy/docker-upgrade.sh

clean: ## Clean build artifacts
	rm -rf dist node_modules/.cache
	@echo "✅ Cleaned"

preflight: ## Run checks before commit
	pnpm lint
	pnpm typecheck
	pnpm prisma validate
	@echo "✅ Preflight passed"

dev: ## Start development mode
	pnpm dev

install: ## Run installation script
	bash scripts/install.sh

deploy: ## Deploy to production with concurrency lock
	bash scripts/deploy_lock.sh bash scripts/deploy_production.sh

deploy-all: ## Build+up+migrate+health (api, worker, frontend)
	bash scripts/deploy/deploy-all.sh

deploy-all-root: ## Deploy usando docker-compose.yml da raiz (força)
	COMPOSE_FILE=./docker-compose.yml bash scripts/deploy/deploy-all.sh

switch-to-supabase: ## Migra DB (Supabase) e troca API/Worker para o Supabase
	bash scripts/deploy/switch-to-supabase.sh

warp-enable: ## Enable Cloudflare WARP (wgcf) for IPv6 egress (keeps IPv4 direct)
	bash scripts/infra/enable-warp-ipv6.sh

warp-disable: ## Disable Cloudflare WARP (wgcf). Use PURGE=1 to remove config
	@if [ "$(PURGE)" = "1" ]; then \
		bash scripts/infra/disable-warp-ipv6.sh --purge; \
	else \
		bash scripts/infra/disable-warp-ipv6.sh; \
	fi

warp-status: ## Show WARP (wgcf) status + IPv6 check
	@systemctl is-active wg-quick@wgcf || true
	@ip -6 route | sed -n '1,50p' || true
	@echo 'IPv6 egress:'; curl -6 -s https://ifconfig.co || echo 'no ipv6'

create-patch: ## Create a new patch (use VERSION=x.x.x)
	@if [ -z "$(VERSION)" ]; then \
		bash scripts/create-patch.sh; \
	else \
		bash scripts/create-patch.sh $(VERSION); \
	fi

apply-patch: ## Apply a patch (use VERSION=x.x.x)
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ Error: VERSION not specified"; \
		echo "Usage: make apply-patch VERSION=2.2.0"; \
		exit 1; \
	else \
		bash scripts/apply-patch.sh $(VERSION); \
	fi

rollback-patch: ## Rollback a patch (use VERSION=x.x.x)
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ Error: VERSION not specified"; \
		echo "Usage: make rollback-patch VERSION=2.2.0"; \
		exit 1; \
	else \
		bash scripts/rollback-patch.sh $(VERSION); \
	fi

patch-status: ## Show current version and available patches
	@echo "Current Version: $$(cat VERSION 2>/dev/null || echo 'unknown')"
	@echo ""
	@echo "Available Patches:"
	@ls -la patches/ 2>/dev/null || echo "No patches directory found"
	@echo ""
	@echo "Recent Backups:"
	@ls -lat backups/ 2>/dev/null | head -n 5 || echo "No backups directory found"
