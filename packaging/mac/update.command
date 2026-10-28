#!/bin/bash
# 從 GitHub 下載最新版並更新程式（資料不受影響）。
# 注意：更新時這個檔案本身會被換掉，所以最後用 exec 交給 Node 執行，bash 不會再讀這個檔案。
cd "$(dirname "$0")" || exit 1
NODE="./.local/node/bin/node"
if [ ! -x "$NODE" ]; then
  echo; echo "   尚未安裝：請先雙擊 install.command。"; echo
  read -r -p "   按 Enter 關閉…" _; exit 1
fi
exec "$NODE" local/update.mjs "$@"
