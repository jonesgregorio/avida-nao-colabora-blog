#!/usr/bin/env bash
#
# Valida o que aconteceu com o diretório de migrations entre duas revisões.
#
# Regra do projeto: uma migration já aplicada em produção nunca pode ser
# editada, renomeada ou removida. O pipeline só tem permissão para executar
# migrations NOVAS (adicionadas).
#
# Uso:
#   validate-migrations.sh <base-ref> <head-ref> [arquivo-de-saida]
#
# O terceiro argumento, quando informado, recebe a lista de migrations novas
# (uma por linha) para que o passo de aplicação consuma apenas esses arquivos.
#
# Saída: 0 quando o diff é seguro, 1 quando há violação.

set -euo pipefail

BASE_REF="${1:?informe a revisão base}"
HEAD_REF="${2:?informe a revisão head}"
ADDED_OUTPUT="${3:-}"

MIGRATIONS_DIR="kind-lucid-clarke/mnt/outputs/avida-nao-colabora-blog/supabase/migrations"

if [ -n "$ADDED_OUTPUT" ]; then
  : > "$ADDED_OUTPUT"
fi

if ! git rev-parse --verify --quiet "$BASE_REF^{commit}" > /dev/null; then
  echo "ERRO: revisão base '$BASE_REF' não existe neste checkout."
  echo "O histórico precisa ser buscado com profundidade suficiente (fetch-depth: 0)."
  exit 1
fi

if ! git rev-parse --verify --quiet "$HEAD_REF^{commit}" > /dev/null; then
  echo "ERRO: revisão head '$HEAD_REF' não existe neste checkout."
  exit 1
fi

# -M ativa a detecção de renomeação para que um rename não se disfarce de
# "removeu um arquivo e adicionou outro".
diff_output=$(git diff --name-status -M "$BASE_REF" "$HEAD_REF" -- "$MIGRATIONS_DIR" || true)

added=()
modified=()
deleted=()
renamed=()
other=()

while IFS=$'\t' read -r status path extra; do
  [ -z "$status" ] && continue
  case "$status" in
    A)   added+=("$path") ;;
    M)   modified+=("$path") ;;
    D)   deleted+=("$path") ;;
    R*)  renamed+=("$path -> $extra") ;;
    *)   other+=("$status $path") ;;
  esac
done <<< "$diff_output"

violations=0

if [ ${#modified[@]} -gt 0 ]; then
  violations=1
  echo "ERRO: migration histórica foi MODIFICADA."
  for item in "${modified[@]}"; do echo "  - $item"; done
  echo
  echo "  Migrations já aplicadas em produção são imutáveis. Reexecutar o arquivo"
  echo "  inteiro pode duplicar ou desfazer estado real do banco."
  echo "  Correção: reverta a alteração e crie uma NOVA migration com o ajuste."
  echo
fi

if [ ${#deleted[@]} -gt 0 ]; then
  violations=1
  echo "ERRO: migration histórica foi REMOVIDA."
  for item in "${deleted[@]}"; do echo "  - $item"; done
  echo
  echo "  Remover o arquivo não desfaz o que já foi aplicado no banco e destrói"
  echo "  a rastreabilidade entre Git e produção."
  echo "  Correção: restaure o arquivo e escreva uma NOVA migration que reverta o efeito."
  echo
fi

if [ ${#renamed[@]} -gt 0 ]; then
  violations=1
  echo "ERRO: migration histórica foi RENOMEADA."
  for item in "${renamed[@]}"; do echo "  - $item"; done
  echo
  echo "  Renomear faz o pipeline tratar a migration antiga como nova e aplicá-la de novo."
  echo "  Correção: restaure o nome original. Nomes históricos não são corrigidos retroativamente."
  echo
fi

if [ ${#other[@]} -gt 0 ]; then
  violations=1
  echo "ERRO: alteração não suportada no diretório de migrations."
  for item in "${other[@]}"; do echo "  - $item"; done
  echo
fi

for path in ${added[@]+"${added[@]}"}; do
  case "$path" in
    *.sql) ;;
    *)
      violations=1
      echo "ERRO: apenas arquivos .sql são aceitos no diretório de migrations."
      echo "  - $path"
      echo
      ;;
  esac
done

if [ "$violations" -ne 0 ]; then
  echo "Validação de migrations REPROVADA."
  exit 1
fi

if [ ${#added[@]} -eq 0 ]; then
  echo "Nenhuma migration nova entre $BASE_REF e $HEAD_REF."
  exit 0
fi

echo "Migrations novas detectadas (${#added[@]}):"
for path in "${added[@]}"; do
  echo "  + $path"
  if [ -n "$ADDED_OUTPUT" ]; then
    echo "$path" >> "$ADDED_OUTPUT"
  fi
done

echo "Validação de migrations APROVADA."
