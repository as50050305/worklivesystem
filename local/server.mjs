// 本機模式伺服器：內嵌 Postgres（PGlite）＋ Supabase 相容 API（PostgREST 子集、Storage）＋ 網頁。
// 全部資料都在這台電腦的 data 資料夾，不連任何雲端服務。
//
// 用法：node local/server.mjs [--no-open] [--port 5858]
//       node local/server.mjs --restore-snapshot <data/snapshots/xxx.tar.gz>
import { PGlite } from '@electric-sql/pglite'
import { exec } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.resolve(process.env.WLS_DATA || path.join(ROOT, 'data'))
const PGDATA = path.join(DATA, 'pgdata')
const FILES = path.join(DATA, 'files')
const SNAPSHOTS = path.join(DATA, 'snapshots')
const DIST = path.join(ROOT, 'dist')
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations')
const OWNER = '00000000-0000-0000-0000-000000000001'
const KEEP_SNAPSHOTS = 14
const VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8')).version
  } catch {
    return '開發版'
  }
})()

const args = process.argv.slice(2)
const argVal = (name) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const PORT = Number(argVal('--port') || process.env.WLS_PORT || 5858)
process.title = '工作生活規劃'
const OPEN = !args.includes('--no-open') && process.env.WLS_NO_OPEN !== '1'
const URL_BASE = `http://localhost:${PORT}`

const log = (...m) => console.log(`[${new Date().toLocaleTimeString('zh-TW', { hour12: false })}]`, ...m)

/* ================= 資料庫 ================= */

const STUBS = `
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create schema if not exists storage;
create schema if not exists local_meta;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
grant usage on schema public, auth, storage to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
create table if not exists local_meta.migrations (name text primary key, applied_at timestamptz not null default now());
create table if not exists local_meta.objects (key text primary key, content_type text not null, size bigint not null, updated_at timestamptz not null default now());
`

async function openDb() {
  await fsp.mkdir(DATA, { recursive: true })
  const db = await PGlite.create({ dataDir: PGDATA })
  await db.exec("set timezone = 'UTC'")
  await db.exec(STUBS)
  // 依檔名順序套用尚未套用的 migration（之後改版只要重新執行 install.bat）
  const applied = new Set((await db.query('select name from local_meta.migrations')).rows.map((r) => r.name))
  const files = fs.existsSync(MIGRATIONS) ? fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort() : []
  const pending = files.filter((f) => !applied.has(f))
  // 已有資料、而且這次要更新資料庫結構：先完整備份一份，萬一新版有問題可以用 --restore-snapshot 回去
  if (pending.length && applied.size) {
    await fsp.mkdir(SNAPSHOTS, { recursive: true })
    const file = path.join(SNAPSHOTS, `db-升級前-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}.tar.gz`)
    await fsp.writeFile(file, Buffer.from(await (await db.dumpDataDir('gzip')).arrayBuffer()))
    log('資料庫即將更新，已先備份到：', path.relative(ROOT, file))
  }
  for (const f of pending) {
    log('套用資料庫更新：', f)
    await db.transaction(async (tx) => {
      await tx.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'))
      await tx.query('insert into local_meta.migrations (name) values ($1)', [f])
    })
  }
  return db
}

/** 每天第一次啟動時，把整個資料庫打包一份到 data/snapshots（保留最近 14 份） */
async function dailySnapshot(db) {
  await fsp.mkdir(SNAPSHOTS, { recursive: true })
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const file = path.join(SNAPSHOTS, `db-${stamp}.tar.gz`)
  if (fs.existsSync(file)) return
  const blob = await db.dumpDataDir('gzip')
  await fsp.writeFile(file, Buffer.from(await blob.arrayBuffer()))
  const all = (await fsp.readdir(SNAPSHOTS)).filter((f) => /^db-\d{8}\.tar\.gz$/.test(f)).sort()
  for (const old of all.slice(0, Math.max(0, all.length - KEEP_SNAPSHOTS))) await fsp.rm(path.join(SNAPSHOTS, old), { force: true })
  log('已建立今天的資料庫快照：', path.relative(ROOT, file))
}

async function restoreSnapshot(file) {
  const abs = path.resolve(file)
  if (!fs.existsSync(abs)) throw new Error(`找不到快照檔：${abs}`)
  if (fs.existsSync(PGDATA)) {
    const moved = `${PGDATA}-還原前-${Date.now()}`
    await fsp.rename(PGDATA, moved)
    log('目前的資料庫已移到：', path.relative(ROOT, moved))
  }
  const blob = new Blob([await fsp.readFile(abs)])
  const db = await PGlite.create({ dataDir: PGDATA, loadDataDir: blob })
  await db.query('select 1')
  await db.close()
  log('還原完成。附件檔案（data/files）不受影響。')
}

/* ================= HTTP 工具 ================= */

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD',
  'access-control-expose-headers': 'content-range',
}
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...CORS, 'content-type': 'application/json; charset=utf-8', ...headers })
  res.end(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body))
}
async function readRaw(req) {
  const chunks = []
  for await (const c of req) chunks.push(c)
  return Buffer.concat(chunks)
}
async function readJson(req) {
  const s = (await readRaw(req)).toString('utf8')
  return s ? JSON.parse(s) : undefined
}
function httpErr(status, code, message) {
  const e = new Error(message)
  e.status = status
  e.code = code
  return e
}
const ID = /^[a-z_][a-z0-9_]*$/
const qi = (s) => {
  if (!ID.test(s)) throw httpErr(400, 'PGRST100', `bad identifier ${s}`)
  return `"${s}"`
}
const toParam = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v)

/* ================= PostgREST 子集 ================= */

function splitTop(s) {
  const out = []
  let depth = 0
  let q = false
  let cur = ''
  for (const ch of s) {
    if (ch === '"') q = !q
    if (!q && ch === '(') depth++
    if (!q && ch === ')') depth--
    if (!q && depth === 0 && ch === ',') {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}
const unq = (v) => (v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v)

function buildFilter(col, expr, params) {
  let not = false
  if (expr.startsWith('not.')) {
    not = true
    expr = expr.slice(4)
  }
  const dot = expr.indexOf('.')
  const op = expr.slice(0, dot)
  const val = expr.slice(dot + 1)
  const c = qi(col)
  const ops = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }
  let sql
  if (ops[op]) {
    params.push(op === 'like' || op === 'ilike' ? val.replaceAll('*', '%') : val)
    sql = `${c} ${ops[op]} $${params.length}`
  } else if (op === 'is') {
    const v = val.toLowerCase()
    if (!['null', 'true', 'false', 'unknown'].includes(v)) throw httpErr(400, 'PGRST100', 'bad is')
    sql = `${c} is ${v}`
  } else if (op === 'in') {
    const inner = val.replace(/^\(/, '').replace(/\)$/, '')
    const items = inner ? splitTop(inner).map(unq) : []
    sql = items.length ? `${c} in (${items.map((it) => (params.push(it), `$${params.length}`)).join(',')})` : 'false'
  } else throw httpErr(400, 'PGRST100', `unsupported operator ${op}`)
  return not ? `not (${sql})` : sql
}

function parseQuery(url) {
  const params = []
  const where = []
  let select = '*'
  let order = ''
  let limit = ''
  let offset = ''
  for (const [k, v] of url.searchParams) {
    if (k === 'select') select = v
    else if (k === 'order') order = v
    else if (k === 'limit') limit = v
    else if (k === 'offset') offset = v
    else if (k === 'columns' || k === 'on_conflict') continue
    else where.push(buildFilter(k, v, params))
  }
  const cols =
    select.trim() === '' || select === '*'
      ? '*'
      : splitTop(select)
          .map((s) => {
            s = s.trim()
            if (s === '*') return '*'
            if (s.includes('(')) throw httpErr(400, 'PGRST100', 'embedding not supported')
            const [alias, name] = s.includes(':') ? s.split(':') : [null, s]
            return alias ? `${qi(name)} as ${qi(alias)}` : qi(name)
          })
          .join(',')
  const orderSql = order
    ? 'order by ' +
      order
        .split(',')
        .map((o) => {
          const [col, dir, nulls] = o.split('.')
          return `${qi(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`
        })
        .join(', ')
    : ''
  return {
    params,
    whereSql: where.length ? 'where ' + where.join(' and ') : '',
    cols,
    orderSql,
    limitSql: (limit ? `limit ${Number(limit)}` : '') + (offset ? ` offset ${Number(offset)}` : ''),
  }
}

/** 以 anon 角色（與雲端版相同的 RLS 規則）在交易中執行 */
function asAnon(db, fn) {
  return db.transaction(async (tx) => {
    await tx.exec('set local role anon')
    return fn(tx)
  })
}

function pgErrToHttp(e) {
  if (e.status) return [e.status, { code: e.code, message: e.message, details: null, hint: null }]
  const status = e.code === '42501' ? 403 : e.code === '23505' || e.code === '23503' ? 409 : 400
  return [status, { code: e.code ?? null, message: e.message, details: e.detail ?? null, hint: e.hint ?? null }]
}

async function handleRest(db, req, res, url) {
  const p = url.pathname.replace(/^\/rest\/v1\//, '')
  const prefer = req.headers['prefer'] || ''
  const wantObject = (req.headers['accept'] || '').includes('vnd.pgrst.object')
  const returnRep = prefer.includes('return=representation')
  const countExact = prefer.includes('count=exact')

  if (p.startsWith('rpc/')) {
    const fn = qi(p.slice(4))
    const body = req.method === 'GET' ? Object.fromEntries(url.searchParams) : (await readJson(req)) || {}
    const keys = Object.keys(body)
    const params = keys.map((k) => toParam(body[k]))
    const argSql = keys.map((k, i) => `${qi(k)} => $${i + 1}`).join(', ')
    const out = await asAnon(db, async (tx) => {
      const meta = await tx.query('select proretset from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 and p.proname = $2 limit 1', ['public', p.slice(4)])
      if (!meta.rows.length) throw httpErr(404, 'PGRST202', `function ${p.slice(4)} not found`)
      const sql = meta.rows[0].proretset
        ? `select coalesce(json_agg(x), '[]'::json) as j from public.${fn}(${argSql}) x`
        : `select to_json(public.${fn}(${argSql})) as j`
      return (await tx.query(sql, params)).rows[0].j
    })
    return send(res, 200, JSON.stringify(out ?? null))
  }

  const table = qi(p)
  const q = parseQuery(url)

  if (req.method === 'GET' || req.method === 'HEAD') {
    const out = await asAnon(db, async (tx) => {
      const r = await tx.query(`select coalesce(json_agg(t), '[]'::json) as j from (select ${q.cols} from public.${table} ${q.whereSql} ${q.orderSql} ${q.limitSql}) t`, q.params)
      const count = countExact ? (await tx.query(`select count(*)::int as n from public.${table} ${q.whereSql}`, q.params)).rows[0].n : null
      return { rows: r.rows[0].j, count }
    })
    const headers = { 'content-range': `0-${Math.max(out.rows.length - 1, 0)}/${out.count ?? '*'}` }
    if (req.method === 'HEAD') return send(res, 200, undefined, headers)
    if (wantObject) {
      if (out.rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${out.rows.length} rows`, hint: null })
      return send(res, 200, out.rows[0], headers)
    }
    return send(res, 200, out.rows, headers)
  }

  if (req.method === 'POST') {
    const onConflict = (url.searchParams.get('on_conflict') || 'id').split(',')
    const conflictSql = (keys) => {
      if (prefer.includes('resolution=merge-duplicates')) {
        const upd = keys.filter((k) => !onConflict.includes(k))
        return `on conflict (${onConflict.map(qi).join(',')}) do ${upd.length ? 'update set ' + upd.map((k) => `${qi(k)} = excluded.${qi(k)}`).join(', ') : 'nothing'}`
      }
      if (prefer.includes('resolution=ignore-duplicates')) return `on conflict (${onConflict.map(qi).join(',')}) do nothing`
      return ''
    }
    const body = await readJson(req)
    const rows = Array.isArray(body) ? body : [body]
    const out = await asAnon(db, async (tx) => {
      const result = []
      for (const row of rows) {
        const keys = Object.keys(row)
        const sql = keys.length
          ? `with r as (insert into public.${table} (${keys.map(qi).join(',')}) values (${keys.map((_, i) => `$${i + 1}`).join(',')}) ${conflictSql(keys)} returning *) select coalesce(json_agg(r), '[]'::json) as j from r`
          : `with r as (insert into public.${table} default values returning *) select coalesce(json_agg(r), '[]'::json) as j from r`
        result.push(...(await tx.query(sql, keys.map((k) => toParam(row[k])))).rows[0].j)
      }
      return result
    })
    if (!returnRep) return send(res, 201, undefined)
    return send(res, 201, wantObject ? out[0] : out)
  }

  if (req.method === 'PATCH') {
    const body = (await readJson(req)) || {}
    const keys = Object.keys(body)
    if (!keys.length) throw httpErr(400, 'PGRST100', 'empty update')
    const base = q.params.length
    const sets = keys.map((k, i) => `${qi(k)} = $${base + i + 1}`).join(', ')
    const out = await asAnon(db, async (tx) => {
      const r = await tx.query(`with r as (update public.${table} set ${sets} ${q.whereSql} returning *) select coalesce(json_agg(r), '[]'::json) as j from r`, [...q.params, ...keys.map((k) => toParam(body[k]))])
      return r.rows[0].j
    })
    if (!returnRep) return send(res, 204, undefined)
    if (wantObject) return out.length === 1 ? send(res, 200, out[0]) : send(res, 406, { code: 'PGRST116', message: `JSON object requested, ${out.length} rows returned` })
    return send(res, 200, out)
  }

  if (req.method === 'DELETE') {
    const out = await asAnon(db, async (tx) => {
      const r = await tx.query(`with r as (delete from public.${table} ${q.whereSql} returning *) select coalesce(json_agg(r), '[]'::json) as j from r`, q.params)
      return r.rows[0].j
    })
    if (!returnRep) return send(res, 204, undefined)
    return send(res, 200, out)
  }
  send(res, 405, { message: 'method not allowed' })
}

/* ================= Storage（存在 data/files） ================= */

/**
 * bucket/路徑 → 實際檔案位置。
 * 磁碟上的檔名用路徑的雜湊值，避開 Windows 不允許的字元、保留名稱與長度限制；原始路徑記在 local_meta.objects。
 */
function objectFile(bucket, name) {
  if (!/^[a-z0-9_-]+$/.test(bucket)) throw httpErr(400, 'InvalidKey', 'bad bucket')
  if (!name || name.split('/').some((s) => !s || s === '.' || s === '..') || name.includes('\0')) throw httpErr(400, 'InvalidKey', 'invalid object name')
  const h = crypto.createHash('sha256').update(`${bucket}/${name}`).digest('hex')
  return path.join(FILES, bucket, h.slice(0, 2), h)
}

function extractMultipart(buf, contentType) {
  const mb = /multipart\/form-data;\s*boundary=(.+)$/i.exec(contentType)
  if (!mb) return { buf, type: contentType }
  const boundary = mb[1].replace(/^"|"$/g, '')
  const sep = Buffer.from('--' + boundary)
  let pos = buf.indexOf(sep)
  while (pos >= 0) {
    const headEnd = buf.indexOf(Buffer.from('\r\n\r\n'), pos)
    if (headEnd < 0) break
    const head = buf.subarray(pos, headEnd).toString()
    const next = buf.indexOf(Buffer.from('\r\n--' + boundary), headEnd)
    if (/filename=/i.test(head) || /name=""/.test(head)) {
      const ct = /content-type:\s*([^\r\n]+)/i.exec(head)
      return { buf: buf.subarray(headEnd + 4, next < 0 ? undefined : next), type: ct ? ct[1].trim() : 'application/octet-stream' }
    }
    pos = next < 0 ? -1 : next + 2
  }
  return { buf, type: 'application/octet-stream' }
}

const signTokens = new Map() // token -> { key, exp }

async function sendObject(db, res, key) {
  const [bucket, ...rest] = key.split('/')
  const file = objectFile(bucket, rest.join('/'))
  const meta = (await db.query('select content_type from local_meta.objects where key = $1', [key])).rows[0]
  if (!meta || !fs.existsSync(file)) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
  res.writeHead(200, { ...CORS, 'content-type': meta.content_type, 'cache-control': 'private, no-store' })
  fs.createReadStream(file).pipe(res)
}

async function handleStorage(db, req, res, url) {
  const p = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ''))
  let m
  // 產生暫時下載網址
  if (req.method === 'POST' && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
    const key = `${m[1]}/${m[2]}`
    const exists = (await db.query('select 1 from local_meta.objects where key = $1', [key])).rows.length
    if (!exists) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    const body = (await readJson(req)) || {}
    const token = crypto.randomBytes(18).toString('base64url')
    signTokens.set(token, { key, exp: Date.now() + Math.min(Number(body.expiresIn) || 600, 86400) * 1000 })
    return send(res, 200, { signedURL: `/object/sign/${m[1]}/${m[2].split('/').map(encodeURIComponent).join('/')}?token=${token}` })
  }
  if (req.method === 'GET' && (m = p.match(/^\/object\/sign\/(.+)$/))) {
    const t = signTokens.get(url.searchParams.get('token') || '')
    if (!t || t.key !== m[1] || t.exp < Date.now()) return send(res, 400, { statusCode: '400', error: 'InvalidJWT', message: '下載連結已過期' })
    return sendObject(db, res, m[1])
  }
  // 直接下載（download()）
  if (req.method === 'GET' && (m = p.match(/^\/object\/(?:authenticated\/)?(.+)$/))) return sendObject(db, res, m[1])
  // 上傳
  if ((req.method === 'POST' || req.method === 'PUT') && (m = p.match(/^\/object\/([^/]+)\/(.+)$/))) {
    const [, bucket, name] = m
    if (!name.startsWith(`${OWNER}/`)) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' })
    const key = `${bucket}/${name}`
    const file = objectFile(bucket, name)
    const upsert = String(req.headers['x-upsert'] || '').toLowerCase() === 'true' || req.method === 'PUT'
    const exists = (await db.query('select 1 from local_meta.objects where key = $1', [key])).rows.length
    if (exists && !upsert) return send(res, 400, { statusCode: '409', error: 'Duplicate', message: 'The resource already exists' })
    const { buf, type } = extractMultipart(await readRaw(req), req.headers['content-type'] || 'application/octet-stream')
    await fsp.mkdir(path.dirname(file), { recursive: true })
    await fsp.writeFile(file, buf)
    await db.query(
      `insert into local_meta.objects (key, content_type, size) values ($1, $2, $3)
       on conflict (key) do update set content_type = excluded.content_type, size = excluded.size, updated_at = now()`,
      [key, type, buf.length],
    )
    return send(res, 200, { Key: key, Id: crypto.randomUUID() })
  }
  // 刪除（remove([...])）
  if (req.method === 'DELETE' && (m = p.match(/^\/object\/([^/]+)$/))) {
    const body = (await readJson(req)) || {}
    const out = []
    for (const name of body.prefixes || []) {
      const key = `${m[1]}/${name}`
      const r = await db.query('delete from local_meta.objects where key = $1 returning key', [key])
      await fsp.rm(objectFile(m[1], name), { force: true })
      if (r.rows.length) out.push({ name })
    }
    return send(res, 200, out)
  }
  send(res, 404, { message: 'storage route not found' })
}

/* ================= Auth（免登入：只回應必要的端點） ================= */

function handleAuth(req, res, url) {
  const p = url.pathname.replace(/^\/auth\/v1/, '')
  if (p === '/logout') return send(res, 204, undefined)
  if (p === '/user') return send(res, 401, { code: 401, error_code: 'no_authorization', msg: '本機模式不使用登入' })
  send(res, 400, { code: 400, msg: '本機模式不使用登入' })
}

/* ================= 網頁（dist） ================= */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
}

async function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname)
  if (rel.endsWith('/')) rel += 'index.html'
  let file = path.join(DIST, rel)
  if (!file.startsWith(DIST + path.sep)) return send(res, 400, { message: 'bad path' })
  let stat = await fsp.stat(file).catch(() => null)
  if (!stat || !stat.isFile()) {
    // 前端路由（例如 /projects/123）一律回 index.html；有副檔名的找不到就是 404
    if (path.extname(rel)) return send(res, 404, { message: 'not found' }, { 'content-type': 'text/plain; charset=utf-8' })
    file = path.join(DIST, 'index.html')
    stat = await fsp.stat(file).catch(() => null)
    if (!stat) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
      return res.end('找不到網頁檔（dist 資料夾）。請先執行 install.bat。')
    }
  }
  const base = path.basename(file)
  const noCache = base === 'index.html' || base === 'sw.js' || base.startsWith('workbox-') || base.endsWith('.webmanifest')
  const hashed = /[-.][A-Za-z0-9_-]{8,}\.(js|css|woff2?|wasm)$/.test(base)
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': noCache ? 'no-cache' : hashed ? 'public, max-age=31536000, immutable' : 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

/* ================= 測試用（只有 WLS_TEST=1 時開啟） ================= */

async function handleTestAdmin(db, req, res, url) {
  if (url.pathname === '/admin/sql') {
    const { sql, params } = await readJson(req)
    if (params?.length) return send(res, 200, (await db.query(sql, params)).rows)
    const results = await db.exec(sql)
    return send(res, 200, results.at(-1)?.rows ?? [])
  }
  if (url.pathname === '/admin/storage-count') {
    const n = (await db.query('select count(*)::int as n from local_meta.objects')).rows[0].n
    return send(res, 200, { n })
  }
  send(res, 404, {})
}

/* ================= 啟動 ================= */

function openBrowser() {
  if (!OPEN) return
  const cmd = process.platform === 'win32' ? `start "" "${URL_BASE}/"` : process.platform === 'darwin' ? `open "${URL_BASE}/"` : `xdg-open "${URL_BASE}/"`
  exec(cmd, () => {})
}

async function alreadyRunning() {
  try {
    const r = await fetch(`${URL_BASE}/__local/health`, { signal: AbortSignal.timeout(2000) })
    return r.ok && (await r.json()).app === 'worklivesystem'
  } catch {
    return false
  }
}

async function main() {
  const snap = argVal('--restore-snapshot')
  if (snap) {
    if (await alreadyRunning()) throw new Error('請先關閉正在執行的「工作生活規劃」視窗，再還原快照。')
    await restoreSnapshot(snap)
    return
  }

  if (await alreadyRunning()) {
    log('已經在執行中，直接開啟瀏覽器。')
    openBrowser()
    return
  }

  log('啟動中…（第一次會比較久）')
  const db = await openDb()
  await dailySnapshot(db).catch((e) => log('快照失敗（不影響使用）：', e.message))

  const server = http.createServer(async (req, res) => {
    // 只接受本機連線
    const host = String(req.headers.host || '')
    if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return send(res, 403, { message: 'local only' })
    try {
      if (req.method === 'OPTIONS') return send(res, 204, undefined)
      const url = new URL(req.url, URL_BASE)
      if (url.pathname === '/__local/health') return send(res, 200, { app: 'worklivesystem', ok: true, version: VERSION })
      if (url.pathname.startsWith('/rest/v1/')) return await handleRest(db, req, res, url)
      if (url.pathname.startsWith('/storage/v1/')) return await handleStorage(db, req, res, url)
      if (url.pathname.startsWith('/auth/v1')) return handleAuth(req, res, url)
      if (process.env.WLS_TEST === '1' && url.pathname.startsWith('/admin/')) return await handleTestAdmin(db, req, res, url)
      if (url.pathname.startsWith('/realtime/')) return send(res, 404, { message: '本機模式不使用即時同步' })
      if (req.method === 'GET' || req.method === 'HEAD') return await serveStatic(req, res, url)
      send(res, 404, { message: 'not found' })
    } catch (e) {
      const [s, b] = pgErrToHttp(e)
      if (s >= 500 || process.env.DEBUG) console.error(e)
      if (!res.headersSent) send(res, s, b)
      else res.end()
    }
  })
  // 拒絕 WebSocket（即時同步）連線
  server.on('upgrade', (_req, socket) => socket.destroy())

  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') console.error(`\n連接埠 ${PORT} 已被其他程式使用。可以用 --port 換一個，例如：start.bat --port 5859\n`)
    else console.error(e)
    process.exit(1)
  })

  server.listen(PORT, '127.0.0.1', () => {
    console.log('')
    console.log('  ==============================================')
    console.log(`   工作生活規劃 ${VERSION} 已啟動：${URL_BASE}/`)
    console.log(`   資料位置：${DATA}`)
    console.log('   使用期間請不要關閉這個視窗')
    console.log('   要結束時：關閉這個視窗，或按 Ctrl + C')
    console.log('  ==============================================')
    console.log('')
    openBrowser()
  })

  let closing = false
  const shutdown = async () => {
    if (closing) return
    closing = true
    log('正在安全關閉資料庫…')
    server.close()
    try {
      await db.close()
    } catch {
      /* 已關閉 */
    }
    process.exit(0)
  }
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(sig, shutdown)
}

main().catch((e) => {
  console.error('\n啟動失敗：', e?.message || e)
  if (process.env.DEBUG) console.error(e)
  process.exit(1)
})
