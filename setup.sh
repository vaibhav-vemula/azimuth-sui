#!/usr/bin/env bash
# Azimuth — Sui + Walrus setup helper.
# Checks tooling and walks you through publish → init → run. See SETUP.md for detail.
set -euo pipefail

bold() { printf "\033[1m%s\033[0m\n" "$1"; }
ok()   { printf "  \033[32m✓\033[0m %s\n" "$1"; }
warn() { printf "  \033[33m!\033[0m %s\n" "$1"; }

ROOT="$(cd "$(dirname "$0")" && pwd)"

bold "Azimuth setup — checking tooling"

if command -v sui >/dev/null 2>&1; then ok "sui $(sui --version 2>/dev/null | head -1)"; else
  warn "Sui CLI not found → install: brew install sui   (https://docs.sui.io)"; fi
if command -v node >/dev/null 2>&1; then ok "node $(node --version)"; else
  warn "Node not found → install Node 20+"; fi
if command -v walrus >/dev/null 2>&1; then ok "walrus CLI present"; else
  warn "Walrus CLI not found (only needed for Walrus Sites)"; fi
if command -v python3 >/dev/null 2>&1; then ok "python3 $(python3 --version 2>&1 | awk '{print $2}')"; else
  warn "python3 not found (needed for the hardware receiver)"; fi

cat <<'STEPS'

Next steps (details in SETUP.md):

  1. Fund a testnet wallet:
       sui client switch --env testnet && sui client faucet
       sui keytool export --key-identity $(sui client active-address)   # suiprivkey1...

  2. Publish the Move package:
       cd move/scripts && ./publish.sh

  3. Init the network (owner):
       cd move/scripts && cp .env.example .env && $EDITOR .env && npm i && node setup.mjs

  4. Register each station (per-station key):
       node register.mjs

  5. Run a station:
       cd sui-client && cp .env.example .env && $EDITOR .env && npm i && node index.js
       cd ground_station && python3 azimuth_station.py

  6. Dashboards:
       cd dashboard && npm i && npm run dev            # :3000
       cd image-dashboard && npm i && npm run dev      # :3001
STEPS
