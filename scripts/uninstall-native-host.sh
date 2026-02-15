#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
HOST_NAME="com.codextab.bridge"
NATIVE_DIR="${HOME}/Library/Application Support/Google/Chrome/NativeMessagingHosts"
MANIFEST_PATH="${NATIVE_DIR}/${HOST_NAME}.json"
LAUNCHER_PATH="${ROOT_DIR}/native-host/run-host.sh"

if [[ -f "${MANIFEST_PATH}" ]]; then
  rm -f "${MANIFEST_PATH}"
  echo "[OK] Removed: ${MANIFEST_PATH}"
else
  echo "[INFO] Manifest not found: ${MANIFEST_PATH}"
fi

if [[ -f "${LAUNCHER_PATH}" ]]; then
  rm -f "${LAUNCHER_PATH}"
  echo "[OK] Removed: ${LAUNCHER_PATH}"
fi
