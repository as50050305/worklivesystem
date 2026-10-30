#!/bin/bash
# 開啟「工作生活規劃」。使用期間請保留這個視窗；關掉視窗就會結束程式。
# 固定語系，避免各電腦的語系設定影響腳本行為（macOS 內建 bash 3.2）
export LC_ALL=en_US.UTF-8
# 注意：變數一律寫成 ${VAR}，後面緊接中文或全形符號時，bash 3.2 會把那些位元組當成變數名稱的一部分
cd "$(dirname "$0")" || exit 1
NODE="./.local/node/bin/node"
if [ ! -x "${NODE}" ] || [ ! -f dist/index.html ]; then
  echo
  echo "   尚未安裝：請先雙擊 install.command。"
  echo
  read -r -p "   按 Enter 關閉…" _
  exit 1
fi
exec "${NODE}" local/server.mjs "$@"
