#!/bin/bash
# 開啟「工作生活規劃」。使用期間請保留這個視窗；關掉視窗就會結束程式。
cd "$(dirname "$0")" || exit 1
NODE="./.local/node/bin/node"
if [ ! -x "$NODE" ] || [ ! -f dist/index.html ]; then
  echo
  echo "   尚未安裝：請先雙擊 install.command。"
  echo
  read -r -p "   按 Enter 關閉…" _
  exit 1
fi
exec "$NODE" local/server.mjs "$@"
