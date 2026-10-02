#!/usr/bin/env bash
# Gera um pacote de arquivos de contexto para subir como "conhecimento" em um Gem do Gemini
# especializado em auditar o SurfAI Floripa. Roda de novo sempre que o código mudar bastante.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/.gemini-audit"
rm -rf "$OUT"
mkdir -p "$OUT"

concat_files() {
  local out="$1"; local ext="$2"; shift 2
  : > "$out"
  for f in "$@"; do
    [ -f "$f" ] || continue
    rel="${f#"$ROOT"/}"
    {
      echo "### Arquivo: $rel"
      echo '```'"$ext"
      cat "$f"
      echo '```'
      echo ""
    } >> "$out"
  done
}

# 03 - migrations SQL reais aplicadas no banco
concat_files "$OUT/03-migrations-sql.md" sql "$ROOT"/supabase/migrations/*.sql

# 04 - backend serverless (api/)
concat_files "$OUT/04-codigo-backend-api.md" ts "$ROOT"/api/*.ts

# 05 - lógica de frontend (lib, contexts, hooks) — o "cérebro" do app
concat_files "$OUT/05-codigo-logica-frontend.md" ts "$ROOT"/src/lib/*.ts "$ROOT"/src/lib/*.tsx "$ROOT"/src/contexts/*.tsx "$ROOT"/src/hooks/*.ts

# 06 - páginas
mapfile -t PAGES < <(find "$ROOT/src/pages" -name "*.tsx" | sort)
concat_files "$OUT/06-codigo-paginas.md" tsx "${PAGES[@]}"

# 07 - componentes
mapfile -t COMPONENTS < <(find "$ROOT/src/components" -name "*.tsx" | sort)
concat_files "$OUT/07-codigo-componentes.md" tsx "${COMPONENTS[@]}"

# 01 - arquitetura e regras (fonte: CLAUDE.md, já escrito para uma IA entender o projeto)
cp "$ROOT/CLAUDE.md" "$OUT/01-arquitetura-e-regras.md"

echo "Pacote gerado em: $OUT"
ls -la "$OUT"
