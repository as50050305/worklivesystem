#!/bin/bash
# 工作生活規劃（Mac 版）安裝程式
#   1. 下載 Node.js 到 .local/node（不動到系統、不需要管理員密碼）
#   2. 在桌面放一個「工作生活規劃」啟動檔
# 不會註冊任何帳號、不會上傳資料、不會動到 data 資料夾。可以重複執行。
# 固定語系，避免各電腦的語系設定影響腳本行為（macOS 內建 bash 3.2）
export LC_ALL=en_US.UTF-8
# 注意：變數一律寫成 ${VAR}，後面緊接中文或全形符號時，bash 3.2 會把那些位元組當成變數名稱的一部分
set -eu
cd "$(dirname "$0")"
ROOT="$(pwd)"
LOCAL="${ROOT}/.local"
NODE="${LOCAL}/node/bin/node"
MIRROR="${WLS_NODE_MIRROR:-https://nodejs.org/dist}"
PORT=5858
DESKTOP="${WLS_DESKTOP:-${HOME}/Desktop}"

c() { printf '\033[%sm%s\033[0m\n' "$1" "$2"; }
step() { echo; c 36 "[$1/3] $2"; }
fail() { echo; c 33 "   [X] $1"; echo; read -r -p "   按 Enter 關閉…" _ || true; exit 1; }

VERSION=$(sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' version.json 2>/dev/null | head -1)
NODE_MAJOR=$(sed -n 's/.*"nodeMajor"[[:space:]]*:[[:space:]]*\([0-9]*\).*/\1/p' version.json 2>/dev/null | head -1)
NODE_MAJOR=${NODE_MAJOR:-22}
[ -n "${VERSION}" ] || fail "找不到 version.json，安裝檔可能不完整，請重新下載。"

echo
c 36 "  ============================================"
c 36 "   工作生活規劃 v${VERSION}  Mac 版安裝"
c 36 "   全部資料都存在這台電腦，不需要註冊任何帳號"
c 36 "  ============================================"
echo "   安裝位置：${ROOT}"

# 解除「從網路下載」的標記，之後雙擊 start.command／update.command 才不會被擋
xattr -dr com.apple.quarantine "${ROOT}" 2>/dev/null || true
chmod +x "${ROOT}"/*.command 2>/dev/null || true

while curl -fsS -m 2 "http://127.0.0.1:${PORT}/__local/health" 2>/dev/null | grep -q worklivesystem; do
  echo
  c 33 "  「工作生活規劃」正在執行中。請先關閉它的終端機視窗，然後按 Enter 繼續。"
  read -r _
done

[ -f dist/index.html ] && [ -d local/node_modules ] || fail "安裝檔不完整（缺少 dist 或 local/node_modules），請重新下載 zip 後再執行。"

# ---------- 1. Node.js ----------
step 1 "準備 Node.js（只放在這個資料夾）"
NEED=1
if [ -x "${NODE}" ] && "${NODE}" --version 2>/dev/null | grep -q "^v${NODE_MAJOR}\."; then
  NEED=0; c 32 "      已安裝 $("${NODE}" --version)，略過下載"
fi
if [ "${NEED}" = 1 ]; then
  case "$(uname -m)" in
    arm64|aarch64) ARCH=arm64 ;;
    x86_64) ARCH=x64 ;;
    *) fail "不支援的處理器：$(uname -m)" ;;
  esac
  case "$(uname -s)" in
    Darwin) OS=darwin ;;
    Linux) OS=linux ;;
    *) fail "這是 Mac 版安裝檔" ;;
  esac
  BASE="${MIRROR}/latest-v${NODE_MAJOR}.x"
  echo "      查詢 Node.js ${NODE_MAJOR} 最新版本…"
  SUMS=$(curl -fsSL -m 60 "${BASE}/SHASUMS256.txt") || fail "無法連線到 nodejs.org，請確認網路後再試一次。"
  LINE=$(printf '%s\n' "${SUMS}" | grep -E "^[0-9a-f]{64}  node-v${NODE_MAJOR}\.[0-9]+\.[0-9]+-${OS}-${ARCH}\.tar\.gz$" | head -1)
  [ -n "${LINE}" ] || fail "找不到 Node.js ${NODE_MAJOR} 的 ${OS}-${ARCH} 版本"
  SHA=${LINE%% *}
  FILE=${LINE##* }
  NAME=${FILE%.tar.gz}
  mkdir -p "${LOCAL}"
  echo "      下載 ${NAME}（約 50 MB）…"
  curl -fL --progress-bar -o "${LOCAL}/${FILE}" "${BASE}/${FILE}" || fail "下載失敗，請確認網路後再試一次。"
  ACTUAL=$(shasum -a 256 "${LOCAL}/${FILE}" 2>/dev/null || sha256sum "${LOCAL}/${FILE}")
  [ "${ACTUAL%% *}" = "${SHA}" ] || { rm -f "${LOCAL}/${FILE}"; fail "下載的 Node.js 檔案驗證失敗，請重新執行。"; }
  echo "      解壓縮…"
  rm -rf "${LOCAL}/node" "${LOCAL}/${NAME}"
  tar -xzf "${LOCAL}/${FILE}" -C "${LOCAL}"
  mv "${LOCAL}/${NAME}" "${LOCAL}/node"
  rm -f "${LOCAL}/${FILE}"
  c 32 "      完成：$("${NODE}" --version)"
fi

# ---------- 2. 桌面啟動檔 ----------
step 2 "在桌面建立啟動檔"
if [ -d "${DESKTOP}" ]; then
  LAUNCHER="${DESKTOP}/工作生活規劃.command"
  printf '#!/bin/bash\n# 開啟「工作生活規劃」（由 install.command 建立）\nexec "%s/start.command"\n' "${ROOT}" > "${LAUNCHER}"
  chmod +x "${LAUNCHER}"
  c 32 "      已建立：${LAUNCHER}"
else
  echo "      找不到桌面資料夾，之後可以直接雙擊資料夾裡的 start.command。"
fi

# ---------- 3. 完成 ----------
step 3 "完成"
c 32 "      安裝完成！"
echo
echo "   以後要使用：雙擊桌面上的「工作生活規劃」（或資料夾裡的 start.command）。"
echo "   瀏覽器會自動打開 http://localhost:${PORT}/"
echo "   使用期間會有一個終端機視窗，關掉它就會結束程式。"
echo "   要更新：雙擊 update.command（會從 GitHub 下載最新版，資料不受影響）。"
echo "   資料存在：${ROOT}/data。請定期在 App 的「設定 → 匯出／匯入」備份。"
echo
read -r -p "   要現在開啟嗎？(Y/n) " ANS || ANS=n
case "${ANS}" in
  ""|[Yy]*) exec "${ROOT}/start.command" ;;
esac
