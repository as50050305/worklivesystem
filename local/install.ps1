# 工作生活規劃：本機版安裝程式（由 install.bat 呼叫）
# 會做的事：
#   1. 下載可攜版 Node.js 到 .local\node（不動到系統、不需要系統管理員權限）
#   2. 安裝程式需要的套件（npm ci）
#   3. 建置網頁（本機模式）
#   4. 在桌面建立「工作生活規劃」捷徑
# 不會：註冊任何帳號、上傳任何資料、修改 data 資料夾裡的資料。可以重複執行（更新程式時再執行一次即可）。

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$Root = Split-Path -Parent $PSScriptRoot
$LocalDir = Join-Path $Root '.local'
$NodeDir = Join-Path $LocalDir 'node'
$NodeExe = Join-Path $NodeDir 'node.exe'
$NpmCmd = Join-Path $NodeDir 'npm.cmd'
$NodeMajor = 22
$Port = 5858

function Step($n, $text) { Write-Host ''; Write-Host "[$n/5] $text" -ForegroundColor Cyan }
function Info($text) { Write-Host "      $text" }
function Ok($text) { Write-Host "      $text" -ForegroundColor Green }
function Fail($text) { throw $text }

function Invoke-Npm([string]$Dir, [string[]]$NpmArgs) {
  Push-Location $Dir
  try {
    & $NpmCmd @NpmArgs
    if ($LASTEXITCODE -ne 0) { Fail "npm $($NpmArgs -join ' ') 失敗（代碼 $LASTEXITCODE）" }
  } finally { Pop-Location }
}

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host '   工作生活規劃  本機版安裝' -ForegroundColor DarkCyan
Write-Host '   全部資料都存在這台電腦，不需要註冊任何帳號' -ForegroundColor DarkCyan
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host "   安裝位置：$Root"

# ---------- 0. 如果正在執行，先請使用者關閉 ----------
function Test-Running {
  try {
    $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/__local/health" -TimeoutSec 2
    return $r.app -eq 'worklivesystem'
  } catch { return $false }
}
while (Test-Running) {
  Write-Host ''
  Write-Host '  「工作生活規劃」正在執行中。請先關閉它的黑色視窗，然後按 Enter 繼續。' -ForegroundColor Yellow
  [void](Read-Host)
}

# ---------- 1. Node.js（可攜版） ----------
Step 1 '準備 Node.js（可攜版，只放在這個資料夾）'
$needNode = $true
if (Test-Path $NodeExe) {
  $ver = (& $NodeExe --version) 2>$null
  if ($ver -match "^v$NodeMajor\.") { $needNode = $false; Ok "已安裝 $ver，略過下載" }
}
if ($needNode) {
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
  if (-not [Environment]::Is64BitOperatingSystem) { Fail '需要 64 位元的 Windows 10 或 11。' }
  Info '查詢最新的 Node.js 22 LTS 版本…'
  $index = Invoke-RestMethod -Uri 'https://nodejs.org/dist/index.json' -TimeoutSec 60
  $rel = $index | Where-Object { $_.version -like "v$NodeMajor.*" -and $_.lts -and ($_.files -contains "win-$arch-zip") } | Select-Object -First 1
  if (-not $rel) { Fail "找不到適用的 Node.js $NodeMajor 版本" }
  $name = "node-$($rel.version)-win-$arch"
  $zip = Join-Path $LocalDir "$name.zip"
  New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
  Info "下載 $name（約 30 MB）…"
  Invoke-WebRequest -Uri "https://nodejs.org/dist/$($rel.version)/$name.zip" -OutFile $zip -UseBasicParsing -TimeoutSec 600

  # 驗證檔案完整（官方 SHASUMS256）
  $sums = (Invoke-WebRequest -Uri "https://nodejs.org/dist/$($rel.version)/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 60).Content
  $expected = ($sums -split "`n" | Where-Object { $_ -match "\s$([regex]::Escape("$name.zip"))$" } | ForEach-Object { ($_ -split '\s+')[0] }) | Select-Object -First 1
  $actual = (Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLower()
  if (-not $expected -or $actual -ne $expected.ToLower()) { Remove-Item $zip -Force; Fail '下載的 Node.js 檔案驗證失敗，請重新執行 install.bat' }

  Info '解壓縮…'
  if (Test-Path $NodeDir) { Remove-Item $NodeDir -Recurse -Force }
  $tmp = Join-Path $LocalDir 'unzip-tmp'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  Move-Item (Join-Path $tmp $name) $NodeDir
  Remove-Item $tmp -Recurse -Force
  Remove-Item $zip -Force
  Ok "完成：$(& $NodeExe --version)"
}
# 讓 npm 執行的指令找得到這份 node
$env:Path = "$NodeDir;$env:Path"
$env:npm_config_update_notifier = 'false'
$env:npm_config_fund = 'false'
$env:npm_config_audit = 'false'

# ---------- 2. 套件 ----------
Step 2 '安裝程式套件（第一次約 2～5 分鐘）'
Invoke-Npm $Root @('ci', '--loglevel=error')
Ok '網頁套件完成'
Invoke-Npm (Join-Path $Root 'local') @('ci', '--loglevel=error')
Ok '本機資料庫套件完成'

# ---------- 3. 建置 ----------
Step 3 '建置網頁（本機模式）'
$env:VITE_SUPABASE_URL = 'same-origin'
$env:VITE_SUPABASE_ANON_KEY = 'local'
$env:VITE_LOCAL_MODE = '1'
Invoke-Npm $Root @('run', 'build', '--silent')
if (-not (Test-Path (Join-Path (Join-Path $Root 'dist') 'index.html'))) { Fail '建置失敗：找不到 dist\index.html' }
Ok '建置完成'

# ---------- 4. 桌面捷徑 ----------
Step 4 '建立桌面捷徑'
try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  $lnkPath = Join-Path $desktop '工作生活規劃.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($lnkPath)
  $lnk.TargetPath = Join-Path $Root 'start.bat'
  $lnk.WorkingDirectory = $Root
  $lnk.IconLocation = (Join-Path $PSScriptRoot 'app.ico') + ',0'
  $lnk.Description = '工作生活規劃（本機版）'
  $lnk.WindowStyle = 7  # 視窗最小化
  $lnk.Save()
  Ok "已建立：$lnkPath"
} catch {
  Info "無法建立捷徑（$($_.Exception.Message)）。之後可以直接雙擊資料夾裡的 start.bat。"
}

# ---------- 5. 完成 ----------
Step 5 '完成'
Ok '安裝完成！'
Write-Host ''
Write-Host '   以後要使用：雙擊桌面上的「工作生活規劃」。'
Write-Host "   瀏覽器會自動打開 http://localhost:$Port/"
Write-Host '   使用期間會有一個最小化的黑色視窗，關掉它就會結束程式。'
Write-Host "   資料存在：$(Join-Path $Root 'data')（請記得定期在 App 的「設定 → 匯出／匯入」備份）"
Write-Host ''
$ans = Read-Host '   要現在開啟嗎？(Y/n)'
if ($ans -eq '' -or $ans -match '^[Yy]') {
  Start-Process -FilePath (Join-Path $Root 'start.bat') -WorkingDirectory $Root -WindowStyle Minimized
}
