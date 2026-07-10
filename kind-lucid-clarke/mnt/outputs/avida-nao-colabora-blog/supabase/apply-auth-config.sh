#!/usr/bin/env bash
# Aplica a config de Auth do projeto (Site URL, allow-list de redirect e
# mailer_autoconfirm) a partir de supabase/auth-config.json, via Management API.
#
# Estas configurações NÃO ficam em migration (não são SQL) — são config do painel
# de Authentication. Este script é a forma versionada/reprodutível de aplicá-las.
#
# Uso:
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ./apply-auth-config.sh
#
# (Não virou GitHub Action porque exigiria o escopo `workflow` no token de push.)
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-lejvvhzluggyxlfwfoxl}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?defina SUPABASE_ACCESS_TOKEN}"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="$DIR/auth-config.json"

# PATCH altera SOMENTE os campos presentes no arquivo. Não imprimimos a resposta
# de sucesso: o corpo de config/auth traz a config completa (inclui segredos SMTP).
http=$(curl -sS -o /tmp/auth_resp.json -w '%{http_code}' -X PATCH \
  "https://api.supabase.com/v1/projects/$REF/config/auth" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  --data @"$CONFIG")

echo "HTTP $http"
if [ "$http" -ge 300 ]; then echo "FALHOU:"; cat /tmp/auth_resp.json; echo; exit 1; fi
echo "Config de Auth aplicada com sucesso (Site URL, allow-list, autoconfirm)."
