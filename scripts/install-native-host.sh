#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOST_NAME="com.codextab.bridge"
NATIVE_DIR="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="${NATIVE_DIR}/${HOST_NAME}.json"
LAUNCHER_PATH="${ROOT_DIR}/native-host/run-host.sh"
HOST_JS_PATH="${ROOT_DIR}/native-host/host.js"
EXTENSION_ID="${EXTENSION_ID:-}"
DEFAULT_EXTENSION_ID="flganlpniflbkbgioedlbjmgbknmpkpc"
LEGACY_EXTENSION_IDS=(
  "pdnmhbopkjlmmfnaliekgedfigcimljl"
  "ocifaefkejcimbdnjoaijldnihomclki"
  "hjkphmilkkfpbapnafjbfokibpappmgn"
  "fcaiohbanjnhkphdddlaccommlhdoacc"
)

usage() {
  cat <<'USAGE'
Usage:
  ./scripts/install-native-host.sh [--extension-id <EXTENSION_ID>]

Example:
  ./scripts/install-native-host.sh --extension-id abcdefghijklmnopqrstuvwxyzabcdef
  ./scripts/install-native-host.sh

How to get EXTENSION_ID:
  1) Open chrome://extensions
  2) Enable Developer mode
  3) Load unpacked "extension/" directory
  4) Copy the ID shown on the extension card

If omitted, this script uses the stable unpacked ID:
  flganlpniflbkbgioedlbjmgbknmpkpc
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --extension-id)
      EXTENSION_ID="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "[ERROR] Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "${EXTENSION_ID}" ]]; then
  EXTENSION_ID="${DEFAULT_EXTENSION_ID}"
fi

if [[ ! "${EXTENSION_ID}" =~ ^[a-p]{32}$ ]]; then
  echo "[ERROR] EXTENSION_ID format is invalid. Expected 32 chars, a-p only." >&2
  exit 1
fi

NODE_PATH="$(command -v node || true)"
if [[ -z "${NODE_PATH}" ]]; then
  echo "[ERROR] node command was not found. Install Node.js first." >&2
  exit 1
fi

CODEX_PATH="$(command -v codex || true)"
if [[ -z "${CODEX_PATH}" ]]; then
  echo "[ERROR] codex command was not found. Install Codex CLI first." >&2
  exit 1
fi

mkdir -p "${NATIVE_DIR}"

cat > "${LAUNCHER_PATH}" <<LAUNCHER
#!/usr/bin/env bash
exec "${NODE_PATH}" "${HOST_JS_PATH}"
LAUNCHER

chmod +x "${LAUNCHER_PATH}"
chmod +x "${HOST_JS_PATH}"

ALLOWED_IDS=("${EXTENSION_ID}" "${DEFAULT_EXTENSION_ID}" "${LEGACY_EXTENSION_IDS[@]}")
UNIQUE_IDS=()
for id in "${ALLOWED_IDS[@]}"; do
  found=0
  for existing in "${UNIQUE_IDS[@]-}"; do
    if [[ "${existing}" == "${id}" ]]; then
      found=1
      break
    fi
  done
  if [[ "${found}" -eq 0 ]]; then
    UNIQUE_IDS+=("${id}")
  fi
done

ALLOWED_ORIGINS_JSON=""
for id in "${UNIQUE_IDS[@]}"; do
  ALLOWED_ORIGINS_JSON="${ALLOWED_ORIGINS_JSON}
    \"chrome-extension://${id}/\","
done
ALLOWED_ORIGINS_JSON="$(printf "%s" "${ALLOWED_ORIGINS_JSON}" | sed '$ s/,$//')"

cat > "${MANIFEST_PATH}" <<MANIFEST
{
  "name": "${HOST_NAME}",
  "description": "CodexTab Native Host",
  "path": "${LAUNCHER_PATH}",
  "type": "stdio",
  "allowed_origins": [${ALLOWED_ORIGINS_JSON}
  ]
}
MANIFEST

echo "[OK] Native host installed."
echo "Manifest: ${MANIFEST_PATH}"
echo "Codex: ${CODEX_PATH}"
echo "Node : ${NODE_PATH}"
echo "Allowed extension ids: ${UNIQUE_IDS[*]-}"
