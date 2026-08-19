#!/usr/bin/env bash
# Aplica a configuração de Auth do projeto (Site URL, allow-list e exigência de
# confirmação de e-mail) a partir de supabase/auth-config.json via Management API.
#
# Estas configurações NÃO ficam em migration (não são SQL) — são config do painel
# de Authentication. Este script é a forma versionada/reprodutível de aplicá-las.
#
# Uso:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./apply-auth-config.sh
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-lejvvhzluggyxlfwfoxl}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$DIR/auth-config.json"
RESP="$(mktemp)"
VERIFY="$(mktemp)"
trap 'rm -f "$RESP" "$VERIFY"' EXIT

http=$(curl -sS -o "$RESP" -w '%{http_code}' -X PATCH \
  "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data @"$CONFIG")

echo "PATCH Auth config: HTTP $http"
if [ "$http" -ge 300 ]; then
  jq -r '.message // .error // "Falha ao aplicar configuração de Auth."' "$RESP" 2>/dev/null || echo "Falha ao aplicar configuração de Auth."
  exit 1
fi

# Confirma somente os três campos gerenciados por este arquivo. Não imprimimos a
# resposta completa do endpoint porque ela pode conter configuração SMTP sensível.
verify_http=$(curl -sS -o "$VERIFY" -w '%{http_code}' \
  "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $TOKEN")

echo "GET Auth config para verificação: HTTP $verify_http"
if [ "$verify_http" -ge 300 ]; then
  echo "Falha ao verificar a configuração de Auth após o PATCH."
  exit 1
fi

expected=$(jq -c '{site_url,uri_allow_list,mailer_autoconfirm}' "$CONFIG")
actual=$(jq -c '{site_url,uri_allow_list,mailer_autoconfirm}' "$VERIFY")
if [ "$actual" != "$expected" ]; then
  echo "A configuração retornada pelo Supabase não corresponde ao auth-config.json."
  exit 1
fi

echo "Config de Auth aplicada e verificada: confirmação de e-mail obrigatória."
