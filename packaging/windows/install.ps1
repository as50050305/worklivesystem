# 工作生活規劃（Windows 版）安裝程式 —— 由 install.bat 呼叫
#   1. 下載可攜版 Node.js 到 .local\node（不動到系統、不需要系統管理員權限）
#   2. 在桌面建立「工作生活規劃」捷徑
# 不會註冊任何帳號、不會上傳資料、不會動到 data 資料夾。可以重複執行。

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$Root = Split-Path -Parent $PSScriptRoot
$LocalDir = Join-Path $Root '.local'
$NodeDir = Join-Path $LocalDir 'node'
$NodeExe = Join-Path $NodeDir 'node.exe'
$Mirror = if ($env:WLS_NODE_MIRROR) { $env:WLS_NODE_MIRROR.TrimEnd('/') } else { 'https://nodejs.org/dist' }
$Port = 5858

function Step($n, $text) { Write-Host ''; Write-Host "[$n/3] $text" -ForegroundColor Cyan }
function Info($text) { Write-Host "      $text" }
function Ok($text) { Write-Host "      $text" -ForegroundColor Green }

$version = try { (Get-Content -Raw -Encoding UTF8 (Join-Path $Root 'version.json') | ConvertFrom-Json) } catch { $null }
if (-not $version) { throw '找不到 version.json，安裝檔可能不完整，請重新下載。' }
$NodeMajor = if ($version.nodeMajor) { [int]$version.nodeMajor } else { 22 }

Write-Host ''
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host "   工作生活規劃 v$($version.version)  Windows 版安裝" -ForegroundColor DarkCyan
Write-Host '   全部資料都存在這台電腦，不需要註冊任何帳號' -ForegroundColor DarkCyan
Write-Host '  ============================================' -ForegroundColor DarkCyan
Write-Host "   安裝位置：$Root"

# 從網路下載的檔案會被 Windows 標記，先解除，之後雙擊才不會一直跳警告
try { Get-ChildItem -Path $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike "$Root\data\*" } | Unblock-File -ErrorAction SilentlyContinue } catch {}

function Test-Running {
  try { return (Invoke-RestMethod -Uri "http://127.0.0.1:$Port/__local/health" -TimeoutSec 2).app -eq 'worklivesystem' } catch { return $false }
}
while (Test-Running) {
  Write-Host ''
  Write-Host '  「工作生活規劃」正在執行中。請先關閉它的黑色視窗，然後按 Enter 繼續。' -ForegroundColor Yellow
  [void](Read-Host)
}

if (-not (Test-Path (Join-Path (Join-Path $Root 'dist') 'index.html')) -or -not (Test-Path (Join-Path (Join-Path $Root 'local') 'node_modules'))) {
  throw '安裝檔不完整（缺少 dist 或 local\node_modules），請重新下載 zip 並完整解壓縮後再執行。'
}

# ---------- 1. Node.js ----------
Step 1 '準備 Node.js（可攜版，只放在這個資料夾）'
$needNode = $true
if (Test-Path $NodeExe) {
  $ver = (& $NodeExe --version) 2>$null
  if ($ver -match "^v$NodeMajor\.") { $needNode = $false; Ok "已安裝 $ver，略過下載" }
}
if ($needNode) {
  if (-not [Environment]::Is64BitOperatingSystem) { throw '需要 64 位元的 Windows 10 或 11。' }
  $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
  $base = "$Mirror/latest-v$NodeMajor.x"
  Info "查詢 Node.js $NodeMajor 最新版本…"
  $sums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing -TimeoutSec 60).Content
  if ($sums -is [byte[]]) { $sums = [Text.Encoding]::UTF8.GetString($sums) }
  $line = $sums -split "`n" | Where-Object { $_ -match "^\s*([0-9a-f]{64})\s+(node-v$NodeMajor\.\d+\.\d+-win-$arch\.zip)\s*$" } | Select-Object -First 1
  if (-not $line) { throw "找不到 Node.js $NodeMajor 的 Windows（$arch）版本" }
  [void]($line -match "^\s*([0-9a-f]{64})\s+(\S+)\s*$")
  $sha = $Matches[1]; $file = $Matches[2]; $name = $file -replace '\.zip$', ''
  New-Item -ItemType Directory -Force -Path $LocalDir | Out-Null
  $zip = Join-Path $LocalDir $file
  Info "下載 $name（約 30 MB）…"
  Invoke-WebRequest -Uri "$base/$file" -OutFile $zip -UseBasicParsing -TimeoutSec 600
  if ((Get-FileHash -Algorithm SHA256 -Path $zip).Hash.ToLower() -ne $sha.ToLower()) { Remove-Item $zip -Force; throw '下載的 Node.js 檔案驗證失敗，請重新執行 install.bat' }
  Info '解壓縮…'
  $tmp = Join-Path $LocalDir 'unzip-tmp'
  foreach ($p in @($NodeDir, $tmp)) { if (Test-Path $p) { Remove-Item $p -Recurse -Force } }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  Move-Item (Join-Path $tmp $name) $NodeDir
  Remove-Item $tmp -Recurse -Force
  Remove-Item $zip -Force
  Ok "完成：$(& $NodeExe --version)"
}

# ---------- 2. 桌面捷徑 ----------
Step 2 '建立桌面捷徑'
try {
  $desktop = [Environment]::GetFolderPath('Desktop')
  if (-not $desktop) { throw '找不到桌面資料夾' }
  $lnkPath = Join-Path $desktop '工作生活規劃.lnk'
  $shell = New-Object -ComObject WScript.Shell
  $lnk = $shell.CreateShortcut($lnkPath)
  $lnk.TargetPath = Join-Path $Root 'start.bat'
  $lnk.WorkingDirectory = $Root
  $lnk.IconLocation = (Join-Path $PSScriptRoot 'app.ico') + ',0'
  $lnk.Description = '工作生活規劃（本機版）'
  $lnk.WindowStyle = 7
  $lnk.Save()
  Ok "已建立：$lnkPath"
} catch {
  Info "無法建立捷徑（$($_.Exception.Message)）。之後可以直接雙擊資料夾裡的 start.bat。"
}

# ---------- 3. 完成 ----------
Step 3 '完成'
Ok '安裝完成！'
Write-Host ''
Write-Host '   以後要使用：雙擊桌面上的「工作生活規劃」（或資料夾裡的 start.bat）。'
Write-Host "   瀏覽器會自動打開 http://localhost:$Port/"
Write-Host '   使用期間會有一個最小化的黑色視窗，關掉它就會結束程式。'
Write-Host '   要更新：雙擊 update.bat（會從 GitHub 下載最新版，資料不受影響）。'
Write-Host "   資料存在：$(Join-Path $Root 'data')。請定期在 App 的「設定 → 匯出／匯入」備份。"
Write-Host ''
$ans = Read-Host '   要現在開啟嗎？(Y/n)'
if ($ans -eq '' -or $ans -match '^[Yy]') {
  Start-Process -FilePath (Join-Path $Root 'start.bat') -WorkingDirectory $Root -WindowStyle Minimized
}
