#!/usr/bin/env bash
# UserPromptSubmit hook: when the user's prompt contains "REANUDAMOS TAREA",
# sync this working copy to the latest origin/main before Claude starts working.
# Safe by design: stashes (never discards) uncommitted local changes, and only
# fast-forwards (never force-resets), so it fails loudly instead of silently
# dropping local commits.
set -uo pipefail

PROJECT_DIR="c:/Users/Fvigo/Documents/PANEL INFORMES DE GESTION/panel-informes-gestion-dev"

INPUT="$(cat)"

PROMPT_TEXT="$(printf '%s' "$INPUT" | node -e '
let data = "";
process.stdin.on("data", c => data += c);
process.stdin.on("end", () => {
  try {
    const obj = JSON.parse(data);
    process.stdout.write(obj.prompt || "");
  } catch (e) {
    process.stdout.write("");
  }
});
')"

case "$PROMPT_TEXT" in
  *"REANUDAMOS TAREA"*) ;;
  *) exit 0 ;;
esac

cd "$PROJECT_DIR" 2>/dev/null || {
  node -e "console.log(JSON.stringify({systemMessage: 'REANUDAMOS TAREA: no se encontró la carpeta del proyecto en ' + process.argv[1]}))" "$PROJECT_DIR"
  exit 0
}

if ! git fetch origin >/tmp/reanudar-tarea-fetch.log 2>&1; then
  ERR="$(tr '\n' ' ' < /tmp/reanudar-tarea-fetch.log)"
  node -e "console.log(JSON.stringify({systemMessage: 'REANUDAMOS TAREA: falló git fetch origin. ' + process.argv[1]}))" "$ERR"
  exit 0
fi

STASHED=0
if [[ -n "$(git status --porcelain)" ]]; then
  if git stash push -u -m "auto-stash antes de REANUDAMOS TAREA" >/dev/null 2>&1; then
    STASHED=1
  fi
fi

git checkout main >/dev/null 2>&1

if git merge --ff-only origin/main >/dev/null 2>&1; then
  COMMIT="$(git log -1 --format='%h %s')"
  MSG="Repo sincronizado con GitHub antes de reanudar: $COMMIT."
  if [[ "$STASHED" == "1" ]]; then
    MSG="$MSG Tenías cambios locales sin commitear: quedaron guardados en git stash (no se perdieron)."
  fi
  node -e "const m = process.argv[1]; console.log(JSON.stringify({systemMessage: m, hookSpecificOutput: {hookEventName: 'UserPromptSubmit', additionalContext: m}}))" "$MSG"
else
  node -e "console.log(JSON.stringify({systemMessage: 'REANUDAMOS TAREA: no se pudo sincronizar automáticamente (la rama local diverge de origin/main). Revisar manualmente con git status / git log.'}))"
fi
