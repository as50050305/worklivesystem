import { ExternalLink, Mail, Phone, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Badge, Button, Card, ConfirmDialog, DatePicker, EmptyState, Input } from '@/components/ui'
import { useClientActions, useClientFollowups, useClientLinks, useClientMeetings, useClientMutations, useContacts } from '@/data/clientHooks'
import { useOptionSet, useProjects } from '@/data/projectHooks'
import type { Client, ClientInput } from '@/data/types'
import { parseTimeInput } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { countdown, diffDays, formatDate, formatDateTime } from '@/lib/dates'
import { MAX_FOLLOWUPS } from '@/lib/followup'
import { useToday } from '@/lib/useToday'
import { useOnline } from '@/pwa/useOnline'
import { CountDots, StatusBadge, followupTone } from './shared'

/* ---------------- 追蹤面板（規則 A） ---------------- */
export function FollowupPanel({ client }: { client: Client }) {
  const today = useToday()
  const online = useOnline()
  const actions = useClientActions()
  const fstatus = useOptionSet('followup_status')
  const methods = useOptionSet('followup_method')
  const status = fstatus.byId(client.followup_status_id)
  const [recording, setRecording] = useState(false)
  const [note, setNote] = useState('')
  const [methodId, setMethodId] = useState('')
  const [msg, setMsg] = useState<{ tone: 'danger' | 'success' | 'info'; text: string } | null>(null)

  const show = (r: Awaited<ReturnType<typeof actions.startRound>>, okText: string) => {
    if (!r.ok) setMsg({ tone: 'danger', text: r.reason })
    else setMsg({ tone: r.message ? 'info' : 'success', text: r.message ?? okText })
  }

  // 正數＝已逾期天數
  const late = client.next_followup_on ? diffDays(client.next_followup_on, today) : null
  const canRecord = status?.key === 'following' && client.followup_count < MAX_FOLLOWUPS

  return (
    <Card title={`追蹤 · 第 ${client.round} 輪`}>
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div>
          <p className="tabular font-mono text-6xl font-medium leading-none tracking-tight">
            {client.followup_count}
            <span className="text-2xl text-text-3"> / {MAX_FOLLOWUPS}</span>
          </p>
          <div className="mt-3">
            <CountDots count={client.followup_count} size="lg" />
          </div>
        </div>
        <dl className="grid grid-cols-[96px_1fr] gap-y-2 text-sm">
          <dt className="text-text-2">追蹤狀態</dt>
          <dd>
            <StatusBadge option={status} tone={followupTone(status)} />
          </dd>
          <dt className="text-text-2">本輪開始</dt>
          <dd className="tabular font-mono">{formatDate(client.round_started_on) || '—'}</dd>
          <dt className="text-text-2">下次追蹤</dt>
          <dd className={cn('tabular font-mono', late !== null && late >= 0 && 'font-semibold text-danger')}>
            {client.next_followup_on ? `${formatDate(client.next_followup_on)}（${late! > 0 ? `逾期 ${late} 天` : countdown(client.next_followup_on, today).label}）` : '—'}
          </dd>
          <dt className="text-text-2">冷卻至</dt>
          <dd className="tabular font-mono">{formatDate(client.cooldown_until) || (status?.key === 'cooling' ? '不自動解凍' : '—')}</dd>
        </dl>
      </div>

      {client.no_show_pending && (
        <Alert tone="warning" className="mt-4" action={<Button size="sm" variant="secondary" onClick={() => void actions.clearNoShow(client)}>已寄出</Button>}>
          會議 No show，請寄追蹤信。
        </Alert>
      )}
      {msg && <Alert tone={msg.tone} className="mt-4">{msg.text}</Alert>}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-dashed border-line-soft pt-4">
        <Button
          variant={status?.key === 'following' ? 'secondary' : 'primary'}
          size="sm"
          disabled={!online || actions.pending}
          onClick={async () => show(await actions.startRound(client, today), '已開始新一輪，7 天後追蹤')}
        >
          開始新一輪
        </Button>
        <Button variant={canRecord ? 'primary' : 'secondary'} size="sm" disabled={!online || !canRecord} onClick={() => setRecording((r) => !r)}>
          記錄追蹤
        </Button>
      </div>
      {recording && (
        <form
          className="card-inset mt-3 space-y-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const r = await actions.record(client, today, note.trim(), methodId || null)
            show(r, `已記錄第 ${client.followup_count + 1} 次追蹤`)
            if (r.ok) {
              setNote('')
              setRecording(false)
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <select className="input h-10 text-sm" aria-label="追蹤方式" value={methodId} onChange={(e) => setMethodId(e.target.value)}>
              <option value="">方式（選填）</option>
              {methods.items.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <input className="input h-10 text-sm" placeholder="備註，例如：寄了作品集與報價範圍" aria-label="追蹤備註" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRecording(false)}>
              取消
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={actions.pending}>
              記錄（第 {client.followup_count + 1} 次）
            </Button>
          </div>
        </form>
      )}
      <ManualAdjust client={client} />
    </Card>
  )
}

/** 所有自動欄位都可手動修改 */
function ManualAdjust({ client }: { client: Client }) {
  const { update } = useClientActions()
  const online = useOnline()
  const [count, setCount] = useState(String(client.followup_count))
  const [round, setRound] = useState(String(client.round))
  useEffect(() => {
    setCount(String(client.followup_count))
    setRound(String(client.round))
  }, [client.followup_count, client.round])
  const save = (patch: ClientInput) => update.mutate({ id: client.id, patch })
  return (
    <details className="mt-4 text-sm">
      <summary className="cursor-pointer text-text-2 hover:text-text">手動調整</summary>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <Input
          label="本輪次數（0–5）"
          type="number"
          min={0}
          max={5}
          value={count}
          disabled={!online}
          onChange={(e) => setCount(e.target.value)}
          onBlur={() => {
            const n = Number(count)
            if (Number.isInteger(n) && n >= 0 && n <= 5 && n !== client.followup_count) save({ followup_count: n })
            else setCount(String(client.followup_count))
          }}
        />
        <Input
          label="輪次"
          type="number"
          min={0}
          value={round}
          disabled={!online}
          onChange={(e) => setRound(e.target.value)}
          onBlur={() => {
            const n = Number(round)
            if (Number.isInteger(n) && n >= 0 && n !== client.round) save({ round: n })
            else setRound(String(client.round))
          }}
        />
        <DatePicker label="本輪開始日" value={client.round_started_on} allowEmpty disabled={!online} onChange={(v) => save({ round_started_on: v })} />
        <DatePicker label="下次追蹤日" value={client.next_followup_on} allowEmpty disabled={!online} onChange={(v) => save({ next_followup_on: v })} />
        <DatePicker label="冷卻至" value={client.cooldown_until} allowEmpty disabled={!online} onChange={(v) => save({ cooldown_until: v })} />
      </div>
    </details>
  )
}

/* ---------------- 追蹤紀錄 ---------------- */
export function FollowupLog({ client }: { client: Client }) {
  const q = useClientFollowups(client.id)
  const methods = useOptionSet('followup_method')
  const m = useClientMutations()
  const online = useOnline()
  const [del, setDel] = useState<string | null>(null)
  const list = q.data ?? []
  return (
    <Card title={`追蹤紀錄 · ${list.length}`}>
      {list.length === 0 ? (
        <EmptyState compact title="還沒有追蹤紀錄" />
      ) : (
        <ol className="space-y-1">
          {list.map((f) => (
            <li key={f.id} className="grid grid-cols-[96px_1fr_auto] items-start gap-3 border-b border-dashed border-line-soft py-2 last:border-0">
              <span className="tabular font-mono text-[12px]">{formatDate(f.followed_on)}</span>
              <div className="min-w-0 text-sm">
                <span className="mr-2 inline-flex gap-1">
                  {f.round != null && <Badge>第 {f.round} 輪</Badge>}
                  {f.method_id && <Badge tone="steel">{methods.byId(f.method_id)?.label}</Badge>}
                </span>
                <span className="break-words text-text-2">{f.note}</span>
              </div>
              <Button variant="ghost" size="sm" iconOnly aria-label="刪除追蹤紀錄" disabled={!online} onClick={() => setDel(f.id)} icon={<Trash2 size={13} />} />
            </li>
          ))}
        </ol>
      )}
      <p className="field-help">刪除紀錄不會改變次數；需要時請用「手動調整」。</p>
      <ConfirmDialog
        open={del !== null}
        title="確定要刪除這筆追蹤紀錄？"
        onCancel={() => setDel(null)}
        onConfirm={() => {
          if (del) m.removeFollowup.mutate(del)
          setDel(null)
        }}
      />
    </Card>
  )
}

/* ---------------- 聯絡資料 ---------------- */
function Field({ client, k, label, href, icon }: { client: Client; k: 'phone' | 'email' | 'instagram' | 'website'; label: string; href?: (v: string) => string; icon?: React.ReactNode }) {
  const { update } = useClientActions()
  const online = useOnline()
  const [v, setV] = useState(client[k] ?? '')
  useEffect(() => setV(client[k] ?? ''), [client, k])
  const val = client[k]
  return (
    <div className="flex items-end gap-2">
      <Input label={label} value={v} disabled={!online} onChange={(e) => setV(e.target.value)} onBlur={() => v.trim() !== (val ?? '') && update.mutate({ id: client.id, patch: { [k]: v.trim() || null } })} wrapperClassName="flex-1" />
      {val && href && (
        <a href={href(val)} target="_blank" rel="noreferrer noopener" className="btn btn-ghost btn-icon btn-sm mb-1" aria-label={`開啟${label}`}>
          {icon ?? <ExternalLink size={14} />}
        </a>
      )}
    </div>
  )
}

export function ContactInfoCard({ client }: { client: Client }) {
  const ig = (v: string) => `https://instagram.com/${v.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}`
  const web = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`)
  return (
    <Card title="聯絡資料">
      <div className="space-y-3">
        <Field client={client} k="phone" label="手機" href={(v) => `tel:${v}`} icon={<Phone size={14} />} />
        <Field client={client} k="email" label="Email" href={(v) => `mailto:${v}`} icon={<Mail size={14} />} />
        <Field client={client} k="instagram" label="IG" href={ig} />
        <Field client={client} k="website" label="網站" href={web} />
      </div>
    </Card>
  )
}

/* ---------------- 會議 ---------------- */
export function MeetingsCard({ client }: { client: Client }) {
  const q = useClientMeetings(client.id)
  const m = useClientMutations()
  const online = useOnline()
  const today = useToday()
  const [date, setDate] = useState<string | null>(today)
  const [time, setTime] = useState('14:00')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const now = new Date().toISOString()
  const add = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    const t = parseTimeInput(time)
    if (!date || !t) return setErr('請填日期與時間（例如 14:00）')
    await m.addMeeting.mutateAsync({ id: client.id, startsAt: `${date}T${t}:00+08:00`, note: note.trim() || null })
    setNote('')
  }
  const list = q.data ?? []
  return (
    <Card title="會議">
      {list.length > 0 ? (
        <ul className="space-y-1">
          {list.map((mt) => (
            <li key={mt.id} className="flex items-start gap-2 border-b border-dashed border-line-soft py-2 last:border-0">
              <div className="min-w-0 flex-1">
                <p className={cn('tabular font-mono text-[12px]', mt.starts_at >= now ? 'text-primary-ink' : 'text-text-2')}>
                  {formatDateTime(mt.starts_at)} {mt.starts_at >= now && '・即將到來'}
                </p>
                {mt.note && <p className="break-words text-sm">{mt.note}</p>}
              </div>
              <Button variant="ghost" size="sm" iconOnly aria-label="刪除會議" disabled={!online} onClick={() => m.removeMeeting.mutate(mt.id)} icon={<Trash2 size={13} />} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-3">尚無會議</p>
      )}
      <form onSubmit={add} className="mt-3 space-y-2 border-t border-dashed border-line-soft pt-3">
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <DatePicker value={date} onChange={setDate} />
          <input className="input tabular font-mono" aria-label="會議時間" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <input className="input h-10 flex-1 text-sm" placeholder="會議內容（選填）" aria-label="會議內容" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit" variant="secondary" size="sm" className="h-10" icon={<Plus size={14} />} disabled={!online}>
            新增會議
          </Button>
        </div>
        {err && <p className="field-error">{err}</p>}
      </form>
    </Card>
  )
}

/* ---------------- 關聯人脈 ---------------- */
export function LinkedContactsCard({ client }: { client: Client }) {
  const contacts = useContacts()
  const links = useClientLinks()
  const m = useClientMutations()
  const online = useOnline()
  const [pick, setPick] = useState('')
  const linkedIds = new Set((links.data ?? []).filter((l) => l.client_id === client.id).map((l) => l.contact_id))
  const linked = (contacts.data ?? []).filter((c) => linkedIds.has(c.id))
  const available = (contacts.data ?? []).filter((c) => !linkedIds.has(c.id))
  return (
    <Card title="關聯人脈">
      {linked.length ? (
        <ul className="flex flex-wrap gap-2">
          {linked.map((c) => (
            <li key={c.id} className="chip">
              <Link to={`/contacts?edit=${c.id}`} className="hover:underline">
                {c.name}
                {c.job_title && <span className="ml-1 text-text-3">{c.job_title}</span>}
              </Link>
              <button type="button" aria-label={`取消關聯 ${c.name}`} disabled={!online} onClick={() => m.unlink.mutate({ clientId: client.id, contactId: c.id })} className="-mr-1 grid size-5 place-items-center rounded-full hover:bg-surface-2">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-3">尚未關聯人脈</p>
      )}
      <div className="mt-3 flex gap-2 border-t border-dashed border-line-soft pt-3">
        <select className="input h-10 flex-1 text-sm" aria-label="選擇人脈" value={pick} onChange={(e) => setPick(e.target.value)} disabled={!online}>
          <option value="">選擇人脈…</option>
          {available.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.company ? `（${c.company}）` : ''}
            </option>
          ))}
        </select>
        <Button
          variant="secondary"
          size="sm"
          className="h-10"
          disabled={!pick || !online}
          onClick={async () => {
            await m.link.mutateAsync({ clientId: client.id, contactId: pick })
            setPick('')
          }}
        >
          關聯
        </Button>
      </div>
      <Link to="/contacts?new=1" className="mt-2 inline-block text-xs text-text-2 underline decoration-dotted underline-offset-4">
        新增人脈
      </Link>
    </Card>
  )
}

/* ---------------- 相關專案 ---------------- */
export function RelatedProjectsCard({ client }: { client: Client }) {
  const projects = useProjects()
  const list = (projects.data ?? []).filter((p) => p.client_id === client.id)
  return (
    <Card title="相關專案">
      {list.length ? (
        <ul className="space-y-1">
          {list.map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="block rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                {p.name}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-text-3">報價單成交後會自動建立專案（P6）。</p>
      )}
    </Card>
  )
}
