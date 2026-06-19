#!/usr/bin/env bash
# Publish the Azimuth Move package and print the object IDs you need for .env.
#
# Requires: sui CLI configured for testnet with a funded active address.
# Usage:  ./publish.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(cd "$HERE/.." && pwd)/azimuth"

echo "Building + testing…"
sui move test --path "$PKG_DIR"
sui move build --path "$PKG_DIR"

echo "Publishing…"
OUT="$(sui client publish --gas-budget 300000000 --json "$PKG_DIR")"

echo "$OUT" > "$HERE/publish-output.json"

if command -v jq >/dev/null 2>&1; then
  echo ""
  echo "──────────────── Copy these into your .env files ────────────────"
  PACKAGE_ID=$(echo "$OUT" | jq -r '.objectChanges[] | select(.type=="published") | .packageId')
  echo "PACKAGE_ID=$PACKAGE_ID"

  echo "$OUT" | jq -r --arg pkg "$PACKAGE_ID" '
    .objectChanges[]
    | select(.type=="created")
    | "\(.objectType)\t\(.objectId)"' | while IFS=$'\t' read -r otype oid; do
      case "$otype" in
        *::orbital_vault::StationRegistry) echo "REGISTRY_ID=$oid" ;;
        *::orbital_vault::AdminCap)        echo "ADMIN_CAP_ID=$oid" ;;
        *::access_policy::AccessRegistry)  echo "ACCESS_REGISTRY_ID=$oid" ;;
        *::access_policy::PolicyAdminCap)  echo "POLICY_ADMIN_CAP_ID=$oid" ;;
        0x2::coin::TreasuryCap*)           echo "TREASURY_CAP_ID=$oid" ;;
      esac
  done
  echo "─────────────────────────────────────────────────────────────────"
else
  echo "jq not found — open publish-output.json and copy the IDs manually."
fi
