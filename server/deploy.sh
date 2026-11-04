#!/usr/bin/env bash
# Deploys the relay Worker and points the game at it (RELAY_URL in shared/net.js). Safe to re-run.
# Needs CLOUDFLARE_API_TOKEN made from the "Edit Cloudflare Workers" template (or a prior `npx wrangler login`).
set -euo pipefail
cd "$(dirname "$0")"
die() { echo "deploy: $*" >&2; exit 1; }
[ -d node_modules ] || npm install --silent
npx wrangler whoami >/dev/null 2>&1 || die "wrangler is not authenticated: export CLOUDFLARE_API_TOKEN"
npm test --silent >/dev/null || die "unit tests failed (npm test)"

OUT=$(npx wrangler deploy 2>&1) || { echo "$OUT"; die "wrangler deploy failed"; }
URL=$(echo "$OUT" | grep -oE 'https://[a-zA-Z0-9.-]+\.workers\.dev' | head -1)
[ -n "$URL" ] || { echo "$OUT"; die "could not find the Worker URL in the deploy output"; }
WSS="wss://${URL#https://}"
echo "relay: $WSS"

sed -i.bak -E "s#^export const RELAY_URL = '[^']*';#export const RELAY_URL = '$WSS';#" ../shared/net.js && rm ../shared/net.js.bak
grep -q "^export const RELAY_URL = '$WSS';" ../shared/net.js || die "could not write RELAY_URL into shared/net.js"
echo "shared/net.js: RELAY_URL=$WSS"

# a new workers.dev name can take a minute to resolve
for i in $(seq 1 24); do curl -sf "$URL/health" >/dev/null && break; sleep 5; done
curl -sf "$URL/health" >/dev/null || die "$URL/health is not answering yet; re-run in a minute"
echo "health: ok"
