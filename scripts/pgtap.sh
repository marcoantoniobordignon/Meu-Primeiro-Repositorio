#!/usr/bin/env bash
# Roda os testes pgTAP (supabase/tests/*.test.sql) num Postgres puro: cria o banco, aplica os stubs do que o Supabase
# provê (auth, storage, papéis), todas as migrations em ordem e cada suíte. Falha se uma migration quebrar, se um teste
# falhar ou se o número de testes não bater com o plan().
#   PSQL      comando do psql (padrão: psql). No CI: "sudo -u postgres psql"; aqui como root: "runuser -u postgres -- psql".
#   BANCO     nome do banco de teste (padrão: ninho_teste).
#   uso: scripts/pgtap.sh [arquivo.test.sql ...]
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL=${PSQL:-psql}
BANCO=${BANCO:-ninho_teste}

$PSQL -X -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $BANCO" -c "create database $BANCO" >/dev/null
$PSQL -X -q -v ON_ERROR_STOP=1 -d "$BANCO" -c "create extension if not exists pgcrypto" -c "create extension if not exists pgtap" >/dev/null
$PSQL -X -q -v ON_ERROR_STOP=1 -d "$BANCO" < supabase/tests/_ci/stubs.sql >/dev/null
for m in supabase/migrations/*.sql; do
  if ! $PSQL -X -q -v ON_ERROR_STOP=1 -d "$BANCO" < "$m" >/dev/null 2>/tmp/pgtap-erro.txt; then
    echo "::error file=$m::migration falhou"; cat /tmp/pgtap-erro.txt; exit 1
  fi
done

testes=("$@")
[ ${#testes[@]} -eq 0 ] && testes=(supabase/tests/*.test.sql)
falhas=0
total=0
for t in "${testes[@]}"; do
  saida=$($PSQL -X -q -A -t -v ON_ERROR_STOP=1 -d "$BANCO" < "$t" 2>&1) || { echo "::error file=$t::erro ao rodar"; echo "$saida" | tail -20; falhas=$((falhas + 1)); continue; }
  plano=$(echo "$saida" | sed -n 's/^1\.\.\([0-9]*\)$/\1/p' | head -1)
  oks=$(echo "$saida" | grep -cE '^ok [0-9]+' || true)
  if echo "$saida" | grep -qE '^not ok|Looks like' || [ -z "$plano" ] || [ "$oks" != "$plano" ]; then
    echo "::error file=$t::pgTAP falhou ($oks de ${plano:-?})"
    echo "$saida" | grep -E '^not ok|^#' | head -40
    falhas=$((falhas + 1))
  else
    echo "ok  $(basename "$t"): $oks"
  fi
  total=$((total + oks))
done
echo "pgTAP: $total testes, $falhas suítes com falha"
[ "$falhas" -eq 0 ]
