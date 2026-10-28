# 個人工作＋生活規劃系統

單人使用的 PWA 網頁 App：專案、時間軸、收藏庫、客戶追蹤、報價單、人脈。
React + TypeScript + Vite + Tailwind CSS，資料放在 Supabase，部署到 Vercel。

> 目前進度：**P6（報價單、品項庫、合約 PDF、成交同步）**
>
> ⚠️ **免登入模式**：依需求不使用登入。任何知道網址的人都能讀取與修改資料，請勿公開分享網址，並定期備份（見[安全說明](#安全說明免登入模式)）。

---

## 目錄

1. [專案結構](#專案結構)
2. [建立 Supabase 專案並套用 migration](#1-建立-supabase-專案並套用-migration)
3. [本機開發](#2-本機開發)
4. [推上 GitHub 並部署到 Vercel](#3-推上-github-並部署到-vercel)
5. [安裝 PWA（Windows／Mac／iPhone／Android）](#4-安裝-pwa)
6. [日後改版流程](#5-日後改版流程)
7. [常見問題](#常見問題)

---

## 專案結構

```
├─ supabase/
│  ├─ config.toml                 Supabase CLI 設定（本機用）
│  └─ migrations/                 資料庫 schema（依時間戳依序套用，不可修改已套用的檔案）
├─ src/
│  ├─ data/
│  │  ├─ types.ts                 資料表型別
│  │  └─ repositories/            ★ 唯一可以呼叫 Supabase 的地方
│  ├─ lib/                        純函式工具（dates.ts 等，附 Vitest 單元測試）
│  ├─ app/                        App 狀態（開啟時建立預設資料）
│  ├─ automation/                 每日檢查（跨午夜、回到前景時執行，冪等）
│  ├─ features/timeline/          時間軸元件（項目卡片、編輯抽屜、日／週／月檢視）
│  ├─ features/projects/          專案元件（看板、地圖、詳情各區塊）
│  ├─ features/collections/       收藏庫（編輯抽屜、轉為專案／客戶）
│  ├─ features/clients/           客戶（看板、追蹤面板、會議、關聯人脈）
│  ├─ features/contacts/          人脈編輯
│  ├─ features/settings/          設定頁（選項表、階段模板）
│  ├─ pwa/                        Service Worker 更新提示、離線偵測、安裝提示
│  ├─ layout/                     App 外框、側邊欄、導覽
│  ├─ components/ui/              設計系統元件（按鈕、卡片、Chip、刻度環…）
│  ├─ components/illustrations/   線稿插圖
│  ├─ pages/                      各頁面
│  └─ styles/tokens.css           ★ 色彩與尺寸 token（深色／淺色）
├─ scripts/
│  ├─ check-contrast.mjs          驗證色彩對比（WCAG AA）
│  └─ generate-icons.mjs          由 SVG 產生 PWA 圖示
├─ vercel.json                    SPA 路由與快取標頭
└─ .github/workflows/             CI（型別檢查、測試、建置）與選用的自動 migration
```

**架構原則**

- UI 不直接呼叫 Supabase，一律經過 `src/data/repositories`。
- 自動化邏輯（追蹤、冷卻、重複代辦…）寫成 `src/lib` 下的純 TypeScript 函式並附單元測試。
- 每張表都啟用 RLS，只能存取固定擁有者 `public.owner_id()` 的資料；`user_id` 由資料庫自動帶入。
- 類型／狀態／階段選項存在 `option_items`，可改名、排序；自動化規則只認 `key`（系統鍵），不認名稱，所以改名不會壞掉。有 `key` 的系統選項不可刪除。

---

## 1. 建立 Supabase 專案並套用 migration

### 1-1 建立專案

1. 到 <https://supabase.com> 登入 → **New project**。
2. Region 建議選 **Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**（離台灣近）。
3. 設定一組 **Database Password** 並記下來（套用 migration 會用到）。
4. 建好後到 **Project Settings → API Keys**，記下：
   - Project URL（`https://xxxx.supabase.co`）
   - **anon public** key（或新版 **publishable** key）
   - ⚠️ **service_role／secret key 絕對不要放進前端或 repo。**

### 1-2 套用 migration

需要 Node.js 20.19 以上（建議 22）。在專案資料夾執行：

```bash
npm install
npx supabase login                       # 開瀏覽器授權
npx supabase link --project-ref <ref>    # <ref> 就是網址 https://<ref>.supabase.co 那段
npx supabase db push                     # 會詢問資料庫密碼
```

完成後在 Supabase 後台 **Table Editor** 應可看到 24 張表，**Storage** 有一個私有的 `attachments` bucket。

> 不想裝 CLI 也可以：到後台 **SQL Editor**，依檔名順序貼上 `supabase/migrations/` 內每個 `.sql` 的內容並執行。但之後改版建議用 CLI，才會記錄哪些 migration 已套用過。

### 1-3 Auth 設定（免登入模式）

這個 App 不使用登入，不需要建立使用者。建議到 **Authentication → Sign In / Providers** 關閉 **Allow new users to sign up**，避免有人在你的專案註冊帳號。

第一次開啟 App 時會自動建立預設資料（選項表、顏色標籤、階段模板、合約模板），只會執行一次。

---

## 2. 本機開發

```bash
cp .env.example .env.local     # Windows PowerShell：Copy-Item .env.example .env.local
# 編輯 .env.local，填入 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY

npm install
npm run dev                    # http://localhost:5173
```

其他指令：

| 指令 | 用途 |
|---|---|
| `npm test` | 執行單元測試（Vitest） |
| `npm run typecheck` | TypeScript 型別檢查 |
| `npm run build` | 正式建置到 `dist/` |
| `npm run preview` | 預覽正式建置（可測 PWA 與更新提示） |
| `npm run check:contrast` | 檢查色彩對比是否符合 WCAG AA |
| `npm run db:new <名稱>` | 新增一個 migration 檔 |
| `npm run db:push` | 把新的 migration 套用到雲端資料庫 |

> 開發模式（`npm run dev`）不啟用 Service Worker；要測安裝或更新提示請用 `npm run build && npm run preview`。

**沒有 Supabase 也能先看 Style Guide**：未設定環境變數時，開啟 `/style-guide` 仍可預覽所有元件。

---

## 3. 推上 GitHub 並部署到 Vercel

### 3-1 推上 GitHub

在 GitHub 建立一個**私有** repo（例如 `worklivesystem`），然後在專案資料夾：

```bash
git init
git add .
git commit -m "P1: 專案骨架"
git branch -M main
git remote add origin https://github.com/<你的帳號>/worklivesystem.git
git push -u origin main
```

`.env.local` 已列在 `.gitignore`，不會被上傳。

### 3-2 連接 Vercel（push 到 main 即自動部署）

1. 到 <https://vercel.com> 用 GitHub 登入 → **Add New → Project** → 選剛剛的 repo → **Import**。
2. Framework Preset 會自動偵測為 **Vite**（`vercel.json` 已設定好建置指令與輸出目錄）。
3. 展開 **Environment Variables**，新增（Production、Preview 都勾）：
   - `VITE_SUPABASE_URL` = 你的 Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon／publishable key
4. **Deploy**。完成後會拿到 `https://xxx.vercel.app` 網址。

之後每次 `git push` 到 main，Vercel 會自動重新部署；已開啟的 App 會在側邊欄出現 **「有新版本，點此更新」**（每 15 分鐘、從背景回到前景、或網路恢復時檢查一次；總覽頁也有「檢查更新」按鈕）。

> 改了環境變數後要到 Vercel → Deployments → 最新一筆 → **Redeploy** 才會生效。

### 3-3（選用）資料庫 migration 自動套用

`.github/workflows/db-migrate.yml` 會在 `supabase/migrations/` 有變動並推到 main 時自動執行 `supabase db push`。
要啟用，在 GitHub repo → **Settings → Secrets and variables → Actions** 新增：

- `SUPABASE_ACCESS_TOKEN`（<https://supabase.com/dashboard/account/tokens> 產生）
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_PROJECT_REF`

沒設定就會自動略過，你也可以一直手動 `npm run db:push`。

---

## 4. 安裝 PWA

| 裝置 | 安裝方式 |
|---|---|
| **Windows**（Chrome／Edge） | 開啟網址 → 網址列右側的「安裝」圖示（⊕ 或電腦圖示）→ 安裝。或 Edge 選單 **⋯ → 應用程式 → 將此網站安裝為應用程式**。之後可從開始功能表開啟、釘選到工作列。 |
| **macOS**（Chrome／Edge） | 網址列右側「安裝」圖示 → 安裝。會出現在「應用程式」資料夾與 Launchpad。 |
| **macOS**（Safari 17 以上） | 選單 **檔案 → 加入 Dock**。 |
| **iPhone／iPad**（Safari） | 點 **分享** 按鈕 → **加入主畫面** → 新增。（iOS 上請用 Safari 安裝） |
| **Android**（Chrome） | 開啟網址 → 選單 **⋮ → 安裝應用程式**（或下方出現的安裝提示）。 |

在 Chrome／Edge 開啟時，總覽頁「App 安裝」也會出現 **[ 安裝為 App ]** 按鈕。

---

## 安全說明（免登入模式）

- 前端會帶著 Supabase 的公開 key，知道網址的人就能直接讀寫資料庫裡這個 App 的資料。
- 資料庫仍有保護：只能存取這個 App 的資料、系統選項與「未分類」標籤不可刪除、無法一次清空整張表（TRUNCATE）。
- 建議：不要公開網址（Vercel 專案名稱可取不易猜的名字）、定期匯出備份（P7）。
- 日後想加回保護，可改回 Email＋密碼登入，或在 Vercel（Password Protection）／Cloudflare Access 前面加一道網站密碼；資料不需要搬移。

---

## 5. 日後改版流程

1. 需要改資料庫時：`npm run db:new <描述>` 產生新 migration，**只新增、不修改已套用過的檔案**，用 `alter table … add column` 等方式保留既有資料。
2. 本機測試：`npm test && npm run build`。
3. `git push` → Vercel 自動部署（若有啟用 3-3，migration 也會自動套用；否則手動 `npm run db:push`）。
4. 各裝置會在側邊欄看到「有新版本，點此更新」。

### 備份

設定頁的 JSON 全量匯出／匯入會在 P7 完成。在那之前，可在 Supabase 後台 **Database → Backups** 查看每日備份（免費方案保留 7 天）。

---

## 外部服務

- **地圖**：OpenStreetMap 圖磚（免費，需標示來源，已顯示在地圖右下角）。
- **地點查詢**：OpenStreetMap Nominatim（免費，每秒最多 1 次，只在按「查詢座標」時呼叫）。
- 兩者都不需要 API key；離線時地圖圖磚無法載入，但已輸入的座標仍保留。

---

## 常見問題

**總覽頁顯示「資料庫尚未就緒」**
migration 還沒套用（或有新的 migration 沒套用），請執行 1-2 的 `npx supabase db push`。

**部署後畫面一片空白或顯示「尚未連接 Supabase」**
Vercel 的環境變數沒設定或拼錯，設定後要 Redeploy。

**手機上沒看到更新提示**
App 從背景回到前景時會自動檢查；也可以到總覽頁按「檢查更新」。

**為什麼淺色模式的主色文字是深綠色？**
`#8BE8CB` 在米白底上當文字對比不足，文字與細線會改用 `--c-primary-ink`（深綠），填色仍用原本的薄荷綠。所有色彩 token 都在 `src/styles/tokens.css`。
