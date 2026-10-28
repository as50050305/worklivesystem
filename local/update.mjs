// 工作生活規劃：從 GitHub Releases 下載最新版並更新程式（Windows／Mac 共用）
// 由 update.bat（Windows）或 update.command（Mac）呼叫。
// 只會更換程式檔案；data（你的資料）與 .local（Node.js、GitHub 權杖）完全不動。
//
// 用法：node local/update.mjs [--yes] [--force]
//   --yes    不詢問，直接更新
//   --force  就算已是最新版也重新下載
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LOCAL = path.join(ROOT, '.local')
const TOKEN_FILE = path.join(LOCAL, 'github-token')
const WORK = path.join(LOCAL, 'update')
const API = (process.env.WLS_GITHUB_API || 'https://api.github.com').replace(/\/$/, '')
const PORT = Number(process.env.WLS_PORT || 5858)
const KEEP = new Set(['data', '.local']) // 絕對不覆蓋的資料夾

const args = process.argv.slice(2)
const YES = args.includes('--yes')
const FORCE = args.includes('--force')

// 自己排隊讀取輸入：終端機輸入與管線輸入都能用；輸入結束（EOF）時一律當作空白
const rl = readline.createInterface({ input: process.stdin, terminal: false })
const lines = []
const waiters = []
let inputClosed = false
rl.on('line', (l) => (waiters.length ? waiters.shift()(l) : lines.push(l)))
rl.on('close', () => {
  inputClosed = true
  while (waiters.length) waiters.shift()('')
})
const ask = (q) => {
  process.stdout.write(q)
  if (lines.length) return Promise.resolve(lines.shift())
  if (inputClosed) return Promise.resolve('')
  return new Promise((resolve) => waiters.push(resolve))
}
const say = (s = '') => console.log(s)
const green = (s) => `\x1b[32m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const cyan = (s) => `\x1b[36m${s}\x1b[0m`

class UserError extends Error {}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

/** 1.10.0 > 1.9.3；非數字部分忽略 */
function newer(a, b) {
  const pa = String(a).split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  const pb = String(b).split(/[.+-]/).map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
  return false
}

async function isRunning() {
  try {
    const r = await fetch(`http://127.0.0.1:${PORT}/__local/health`, { signal: AbortSignal.timeout(1500) })
    return r.ok && (await r.json()).app === 'worklivesystem'
  } catch {
    return false
  }
}

function readToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim()
  try {
    return fs.readFileSync(TOKEN_FILE, 'utf8').trim() || null
  } catch {
    return null
  }
}

async function gh(url, token, accept = 'application/vnd.github+json') {
  const headers = { accept, 'user-agent': 'worklivesystem-updater', 'x-github-api-version': '2022-11-28' }
  if (token) headers.authorization = `Bearer ${token}`
  try {
    return await fetch(url.startsWith('http') ? url : API + url, { headers, redirect: 'follow' })
  } catch {
    throw new UserError('無法連線到 GitHub，請確認網路後再試一次。')
  }
}

async function askToken(repo, reason) {
  say()
  say(yellow(`  ${reason}`))
  say('  如果你的 GitHub 專案是「私有」的，需要一組只能讀取的存取權杖（只要設定一次）：')
  say('    1. 打開 https://github.com/settings/personal-access-tokens/new')
  say(`    2. Repository access 選「Only select repositories」→ 選 ${repo}`)
  say('    3. Permissions → Repository permissions → Contents 設為「Read-only」')
  say('    4. 按 Generate token，複製 github_pat_ 開頭的那串文字')
  say('  （權杖只會存在這台電腦的 .local\\github-token，不會上傳到任何地方）')
  say()
  const t = (await ask('  貼上權杖後按 Enter（直接按 Enter 取消）：')).trim()
  if (!t) throw new UserError('已取消更新。')
  return t
}

async function latestRelease(repo) {
  let token = readToken()
  const saved = token
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await gh(`/repos/${repo}/releases/latest`, token)
    if (r.ok) {
      if (token && token !== saved && !process.env.GITHUB_TOKEN) {
        await fsp.mkdir(LOCAL, { recursive: true })
        await fsp.writeFile(TOKEN_FILE, token + '\n', { mode: 0o600 })
        say(green('   權杖可以使用，已儲存在這台電腦，下次不用再輸入。'))
      }
      return { release: await r.json(), token }
    }
    if (r.status === 404 && token) {
      // 有權杖仍是 404：可能還沒發布任何 Release，或權杖沒有這個 repo 的權限
      const repoCheck = await gh(`/repos/${repo}`, token)
      if (repoCheck.ok) throw new UserError('GitHub 上還沒有發布任何 Release。')
    }
    if (r.status === 404 || r.status === 401 || r.status === 403) {
      if (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0') throw new UserError('GitHub 暫時限制查詢次數，請過一小時再試。')
      token = await askToken(repo, token ? '這組權杖無法讀取 Release（可能過期或權限不足）。' : `找不到 ${repo} 的 Release（私有專案需要權杖）。`)
      continue
    }
    throw new UserError(`查詢 GitHub 失敗（HTTP ${r.status}）。`)
  }
  throw new UserError('無法存取 GitHub Release，請確認權杖與專案名稱。')
}

function extract(zip, dest) {
  fs.mkdirSync(dest, { recursive: true })
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${zip.replace(/'/g, "''")}' -DestinationPath '${dest.replace(/'/g, "''")}' -Force`], { stdio: 'inherit' })
  } else if (process.platform === 'darwin') {
    execFileSync('ditto', ['-x', '-k', zip, dest], { stdio: 'inherit' })
  } else {
    execFileSync('unzip', ['-q', '-o', zip, '-d', dest], { stdio: 'inherit' })
  }
}

/** 解壓縮後找出含 version.json 的那一層 */
function findPackageRoot(dir) {
  if (fs.existsSync(path.join(dir, 'version.json'))) return dir
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, 'version.json'))) return path.join(dir, e.name)
  }
  return null
}

async function main() {
  const current = readJson(path.join(ROOT, 'version.json'))
  say()
  say(cyan('  ============================================'))
  say(cyan('   工作生活規劃  檢查更新'))
  say(cyan('  ============================================'))
  if (!current?.repo || !current?.platform) {
    throw new UserError('這個資料夾是「原始碼」版本，請用 GitHub Desktop 的 Pull origin 取得更新，再執行 install.bat。')
  }
  say(`   目前版本：v${current.version}（${current.platform === 'mac' ? 'Mac' : 'Windows'}）`)

  while (await isRunning()) {
    if (inputClosed && !lines.length) throw new UserError('「工作生活規劃」正在執行中，請先關閉它的視窗再更新。')
    say()
    say(yellow('  「工作生活規劃」正在執行中。請先關閉它的視窗，然後按 Enter 繼續。'))
    await ask('')
  }

  say('   正在查詢 GitHub 上的最新版本…')
  const { release, token } = await latestRelease(current.repo)
  const latest = String(release.tag_name || '').replace(/^v/, '')
  say(`   最新版本：v${latest}${release.published_at ? `（${release.published_at.slice(0, 10).replaceAll('-', '/')} 發布）` : ''}`)

  if (!FORCE && !newer(latest, current.version)) {
    say()
    say(green('   已經是最新版，不需要更新。'))
    return
  }

  const asset = (release.assets || []).find((a) => a.name.endsWith('.zip') && a.name.toLowerCase().includes(`-${current.platform}-`))
  if (!asset) throw new UserError(`這個版本還沒有 ${current.platform === 'mac' ? 'Mac' : 'Windows'} 的安裝檔。GitHub 正在打包時請等幾分鐘再試。`)

  if (release.body?.trim()) {
    say()
    say('   更新內容：')
    for (const line of release.body.trim().split(/\r?\n/).slice(0, 20)) say(`     ${line}`)
  }
  say()
  if (!YES) {
    const a = (await ask(`   要更新到 v${latest} 嗎？你的資料不會受影響。(Y/n) `)).trim()
    if (a && !/^y/i.test(a)) throw new UserError('已取消更新。')
  }

  // 下載
  await fsp.rm(WORK, { recursive: true, force: true })
  await fsp.mkdir(WORK, { recursive: true })
  const zip = path.join(WORK, asset.name)
  say(`   下載 ${asset.name}（${(asset.size / 1024 / 1024).toFixed(1)} MB）…`)
  // 用 API 網址下載：公開與私有 repo 都適用（轉址到檔案伺服器時不會帶上權杖）
  const r = await gh(asset.url, token, 'application/octet-stream')
  if (!r.ok) throw new UserError(`下載失敗（HTTP ${r.status}）。`)
  const buf = Buffer.from(await r.arrayBuffer())
  if (asset.size && buf.length !== asset.size) throw new UserError('下載的檔案不完整，請重新執行更新。')
  await fsp.writeFile(zip, buf)

  say('   解壓縮…')
  const out = path.join(WORK, 'extract')
  extract(zip, out)
  const pkg = findPackageRoot(out)
  const next = pkg && readJson(path.join(pkg, 'version.json'))
  if (!next || next.platform !== current.platform) throw new UserError('下載的檔案不是這個平台的安裝檔，已停止更新（沒有改動任何檔案）。')

  // 更換程式檔案：舊檔先搬到暫存區，全部成功才刪除；中途失敗就搬回去（data、.local 不動）
  say('   更換程式檔案…')
  const backup = path.join(WORK, 'old')
  await fsp.mkdir(backup, { recursive: true })
  const moved = []
  try {
    for (const e of fs.readdirSync(pkg, { withFileTypes: true })) {
      if (KEEP.has(e.name)) continue
      const dst = path.join(ROOT, e.name)
      if (fs.existsSync(dst)) {
        await fsp.rename(dst, path.join(backup, e.name))
        moved.push(e.name)
      }
      await fsp.cp(path.join(pkg, e.name), dst, { recursive: true, force: true })
    }
  } catch (err) {
    for (const name of moved) {
      await fsp.rm(path.join(ROOT, name), { recursive: true, force: true }).catch(() => {})
      await fsp.rename(path.join(backup, name), path.join(ROOT, name)).catch(() => {})
    }
    throw new UserError(`更換檔案時發生錯誤，已還原成原本的版本：${err.message}`)
  }
  if (process.platform !== 'win32') {
    for (const f of fs.readdirSync(ROOT)) if (f.endsWith('.command')) await fsp.chmod(path.join(ROOT, f), 0o755)
  }
  await fsp.rm(WORK, { recursive: true, force: true })

  say()
  say(green(`   更新完成！現在是 v${next.version}。`))
  const nodeMajor = Number(process.versions.node.split('.')[0])
  if (next.nodeMajor && next.nodeMajor !== nodeMajor) {
    say(yellow(`   這個版本需要 Node.js ${next.nodeMajor}，請再執行一次 ${current.platform === 'mac' ? 'install.command' : 'install.bat'}。`))
    return
  }
  say('   下次開啟時，資料庫會自動更新（更新前會先備份到 data/snapshots）。')
  say('   如果瀏覽器出現「有新版本，點此更新」，點一下就會換成新畫面。')
}

main()
  .catch((e) => {
    say()
    if (e instanceof UserError) say(yellow(`   ${e.message}`))
    else {
      say(yellow(`   更新失敗：${e?.message || e}`))
      say('   程式檔案若只更新了一半，再執行一次更新即可；你的資料不受影響。')
    }
    process.exitCode = 1
  })
  .finally(() => rl.close())
