#!/bin/bash
# 把建置好的 dist 與本機伺服器打包成 Windows、Mac 兩個 zip（GitHub Actions 的 release.yml 會呼叫）
# 用法：bash packaging/build-release.sh <版本，例如 1.2.0> <owner/repo>
# 前置：已執行 npm run build（本機模式）與 (cd local && npm ci --omit=dev)
set -euo pipefail
VERSION="$1"
REPO="$2"
NODE_MAJOR=22
OUT=release-out
cd "$(dirname "$0")/.."

[ -f dist/index.html ] || { echo "缺少 dist（先執行 npm run build）"; exit 1; }
[ -d local/node_modules/@electric-sql/pglite ] || { echo "缺少 local/node_modules（先執行 cd local && npm ci --omit=dev）"; exit 1; }
grep -q '"same-origin"\|same-origin' dist/assets/*.js || { echo "dist 不是本機模式建置（VITE_SUPABASE_URL 應為 same-origin）"; exit 1; }

rm -rf "$OUT"
mkdir -p "$OUT"
for PLATFORM in windows mac; do
  STAGE="$OUT/stage-$PLATFORM/WorkLifePlanner"
  mkdir -p "$STAGE/local" "$STAGE/supabase"
  cp -R dist "$STAGE/dist"
  cp -R supabase/migrations "$STAGE/supabase/migrations"
  cp local/server.mjs local/update.mjs local/package.json local/package-lock.json local/app.ico "$STAGE/local/"
  cp -R local/node_modules "$STAGE/local/node_modules"
  cat > "$STAGE/version.json" <<JSON
{
  "app": "worklivesystem",
  "version": "$VERSION",
  "platform": "$PLATFORM",
  "repo": "$REPO",
  "nodeMajor": $NODE_MAJOR,
  "builtAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON
  if [ "$PLATFORM" = windows ]; then
    cp packaging/windows/install.bat packaging/windows/start.bat packaging/windows/update.bat packaging/windows/README.txt "$STAGE/"
    cp packaging/windows/install.ps1 "$STAGE/local/install.ps1"
  else
    cp packaging/mac/install.command packaging/mac/start.command packaging/mac/update.command packaging/mac/README.txt "$STAGE/"
    chmod 755 "$STAGE"/*.command
  fi
  ZIP="WorkLifePlanner-$PLATFORM-v$VERSION.zip"
  (cd "$OUT/stage-$PLATFORM" && zip -qrX "../$ZIP" WorkLifePlanner)
  echo "已打包：$OUT/$ZIP（$(du -h "$OUT/$ZIP" | cut -f1)）"
done
