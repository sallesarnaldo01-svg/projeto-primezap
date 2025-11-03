#!/usr/bin/env bash
set -e

echo "== 1) Versão do codex =="
codex --version || echo "codex não encontrado"

echo
echo "== 2) Teste HTTPS para auth.openai.com =="
curl -v https://auth.openai.com/oauth/token 2>&1 | head -n 40 || true

echo
echo "== 3) Atualizar certificados =="
sudo apt update -y
sudo apt install -y ca-certificates ntpdate
sudo update-ca-certificates

echo
echo "== 4) Acertar hora =="
sudo ntpdate pool.ntp.org || true
date

echo
echo "== 5) Tentar de novo com SSL_CERT_FILE =="
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
codex login --debug || true
