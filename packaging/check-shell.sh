#!/bin/bash
# 檢查 Mac／Linux 腳本能在 macOS 內建的 bash 3.2 上執行：
#   1. 語法正確（bash -n）
#   2. 變數一律寫成 ${VAR}（$VAR 後面緊接中文或全形符號時，bash 3.2 會把那些位元組當成變數名稱）
#   3. 不使用 bash 4 以後才有的語法
# 用法：bash packaging/check-shell.sh   （release.yml 打包前會自動執行）
export LC_ALL=C.UTF-8
cd "$(dirname "$0")/.." || exit 1
FILES="${CHECK_FILES:-packaging/mac/install.command packaging/mac/start.command packaging/mac/update.command packaging/build-release.sh packaging/check-shell.sh}"
FAIL=0
bad() { echo "  ✗ ${1}"; FAIL=1; }

for F in ${FILES}; do
  echo "檢查 ${F}"
  bash -n "${F}" || bad "${F}：語法錯誤"
  # 去掉註解行與單引號字串後再檢查（單引號內的 $ 不會展開）
  CODE=$(grep -v '^[[:space:]]*#' "${F}" | sed "s/'[^']*'//g")
  printf '%s\n' "${CODE}" | grep -nE '\$[A-Za-z_]' | grep -v '^[0-9]*:.*\\\$' | sed 's/^/    /' | grep . && bad "${F}：有沒加大括號的變數，請改成 \${VAR}"
  printf '%s\n' "${CODE}" | grep -nE 'declare -A|typeset -A|local -A|mapfile|readarray|coproc|&>>|\|&|;;&|globstar|lastpipe|\[\[ -v |read [^|]*-i |\$\{[A-Za-z_][A-Za-z0-9_]*(\^|,)|\$\{[A-Za-z_][A-Za-z0-9_]*@[QEPAaKku]\}|\{[0-9]+\.\.[0-9]+\.\.[0-9]+\}|printf .*%\(' \
    | sed 's/^/    /' | grep . && bad "${F}：使用了 bash 4 以後的語法（macOS 內建 bash 3.2 不支援）"
done
if [ "${FAIL}" = 0 ]; then echo "全部通過"; else echo "有問題，請修正"; fi
exit "${FAIL}"
