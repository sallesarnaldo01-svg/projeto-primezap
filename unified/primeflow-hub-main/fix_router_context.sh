#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$(pwd)}"
IMAGE_NAME="${IMAGE_NAME:-primezap-frontend:routerfix}"
CONTAINER_NAME="${CONTAINER_NAME:-primezap-frontend}"
HOST_PORT="${HOST_PORT:-8081}"
DOCKER_NETWORK="${DOCKER_NETWORK:-docker_default}"

red(){ printf "\033[31m%s\033[0m\n" "$*"; }
green(){ printf "\033[32m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
step(){ echo; yellow "==> $*"; }
need(){ command -v "$1" >/dev/null 2>&1 || { red "Falta a dependência '$1'"; exit 1; }; }

need sed; need awk; need grep; need find

step "Descobrindo diretório do frontend… (ignorando node_modules/ e backups/)"
mapfile -t PKGS < <(find "$PROJECT_ROOT" -type f -name package.json -not -path "*/node_modules/*" -not -path "*/backups/*" | sort)

CANDIDATES=()
for pj in "${PKGS[@]}"; do
  base="$(dirname "$pj")"
  if find "$base/src" -maxdepth 1 -regex '.*/\(main\|index\)\.\(tsx\|jsx\|js\)' -print -quit 2>/dev/null | grep -q .; then
    CANDIDATES+=("$base")
  fi
done

if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
  red "Nenhum projeto React com src/{main,index}.{tsx,jsx,js} encontrado abaixo de $PROJECT_ROOT."
  exit 1
fi

BEST=""
for c in "${CANDIDATES[@]}"; do
  [[ "$c" =~ frontend ]] && BEST="$c" && break
done
if [[ -z "$BEST" ]]; then
  BEST="$(printf "%s\n" "${CANDIDATES[@]}" | awk '{print length, $0}' | sort -n | head -n1 | cut -d" " -f2-)"
fi
FRONTEND_DIR="$BEST"
green "Frontend: $FRONTEND_DIR"

step "Localizando main/index e App…"
MAIN_FILE="$(find "$FRONTEND_DIR/src" -maxdepth 1 -regex '.*/\(main\|index\)\.\(tsx\|jsx\|js\)' | head -n1 || true)"
APP_FILE="$(find "$FRONTEND_DIR/src"  -maxdepth 1 -regex '.*/App\.\(tsx\|jsx\|js\)' | head -n1 || true)"

if [[ -z "$MAIN_FILE" ]]; then
  red "main/index.{tsx,jsx,js} não encontrado em $FRONTEND_DIR/src"
  exit 1
fi
green "main/index: $MAIN_FILE"
[[ -n "$APP_FILE" ]] && echo "App:        $APP_FILE"

step "Criando backups…"
STAMP=".$(date +%Y%m%d-%H%M%S).bak"
[[ -f "$MAIN_FILE$STAMP" ]] || cp "$MAIN_FILE" "$MAIN_FILE$STAMP"
if [[ -n "$APP_FILE" ]]; then
  [[ -f "$APP_FILE$STAMP" ]] || cp "$APP_FILE" "$APP_FILE$STAMP"
fi

step "Aplicando patch idempotente no $MAIN_FILE…"

# (a) garantir import do BrowserRouter
if ! grep -Eqs "from ['\"]react-router-dom['\"]" "$MAIN_FILE"; then
  sed -i '0,/^import /s//&\
import { BrowserRouter } from "react-router-dom";/' "$MAIN_FILE"
else
  grep -Eq "BrowserRouter" "$MAIN_FILE" || \
  sed -i '0,/from.*react-router-dom/s//&\
import { BrowserRouter } from "react-router-dom";/' "$MAIN_FILE"
fi

# (b) envolver o JSX raiz do render (via Node; fallback sed se Node não existir)
if command -v node >/dev/null 2>&1; then
  if ! node - "$MAIN_FILE" <<'NODE'
const fs=require("fs");
const file=process.argv[1];
let s=fs.readFileSync(file,"utf8");

const wrap = (jsx)=>{
  if(/\bBrowserRouter\b/.test(jsx)) return jsx;
  // abre antes do primeiro "<" de topo e fecha no final do argumento de render
  return jsx
    .replace(/^\s*</m,"<BrowserRouter>\n<")
    .replace(/\)\s*;?\s*$/m,")\n</BrowserRouter>;");
};

let before=s;
s=s.replace(/createRoot\(([\s\S]*?)\)\.render\(([\s\S]*?)\);\s*$/m,(m,a,b)=>{
  return `createRoot(${a}).render(${wrap(b)});`;
});
s=s.replace(/ReactDOM\.render\(\s*([\s\S]*?)\s*,\s*document/m,(m,b)=>{
  return `ReactDOM.render(${wrap(b)}, document`;
});

if(before!==s){ fs.writeFileSync(file,s); console.log("Patch via Node aplicado."); }
else { console.log("Nada a alterar (já estava ok)."); }
NODE
  then
    yellow "Falhou patch via Node; aplicando fallback simples via sed…"
    sed -i 's#\(render(\s*\)#\1<BrowserRouter>\n#; s#(<\s*/\s*App[^>]*>\s*)#\1\n</BrowserRouter>#' "$MAIN_FILE" || true
  fi
else
  yellow "Node ausente; aplicando fallback simples via sed…"
  sed -i 's#\(render(\s*\)#\1<BrowserRouter>\n#; s#(<\s*/\s*App[^>]*>\s*)#\1\n</BrowserRouter>#' "$MAIN_FILE" || true
fi

green "Patch concluído."

# Build opcional
if command -v npm >/dev/null 2>&1; then
  step "Instalando deps e buildando…"
  pushd "$FRONTEND_DIR" >/dev/null
  if [[ -f package-lock.json ]]; then npm ci --legacy-peer-deps; else npm install --legacy-peer-deps; fi
  npm run build
  [[ -d dist || -d build ]] || { red "Build não gerou dist/ nem build/"; exit 1; }
  popd >/dev/null
  green "Build ok."
else
  yellow "Pulando build (npm ausente)."
fi

# Docker opcional
if command -v docker >/dev/null 2>&1 && [[ -f "$FRONTEND_DIR/Dockerfile" ]]; then
  step "Docker build & run…"
  pushd "$FRONTEND_DIR" >/dev/null
  docker build -t "$IMAGE_NAME" .
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run -d --name "$CONTAINER_NAME" --restart unless-stopped \
    --network "$DOCKER_NETWORK" -p "$HOST_PORT:80" "$IMAGE_NAME" >/dev/null
  popd >/dev/null
  step "Validação HTTP rápida…"
  sleep 1
  set +e
  curl -fsSI "http://127.0.0.1:${HOST_PORT}/" | sed -n '1,8p'
  curl -fsS  "http://127.0.0.1:${HOST_PORT}/" | head -n 3
  RC=$?
  set -e
  [[ $RC -eq 0 ]] || { red "Falha ao acessar http://127.0.0.1:${HOST_PORT}/"; exit 1; }
  green "Container online."
else
  yellow "Pulando Docker (sem Dockerfile ou docker ausente)."
fi

cat <<EOF

$(green "✅ Concluído!")

- Verifique o arquivo patchado:
  $MAIN_FILE

- Procure por <BrowserRouter> envolvendo o JSX raiz do render.

- Se ainda der o erro de Router:
  • algum hook (useNavigate/useLocation) pode estar fora da árvore do <BrowserRouter>;
  • mova esse hook para dentro de um componente filho do <BrowserRouter>.

Backups criados:
  - $MAIN_FILE$STAMP
  - ${APP_FILE:-N/A}$([[ -n "${APP_FILE:-}" ]] && echo "$STAMP" || true)

EOF
