import { Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Alert, Button, ConfirmDialog, Input, Select, Textarea } from '@/components/ui'
import { useClientLinks, useClients, useContactMutations, useContacts } from '@/data/clientHooks'
import { clientsRepo } from '@/data/repositories/clientsRepo'
import { invalidateTable } from '@/data/queryClient'
import { useOptionSet } from '@/data/projectHooks'
import type { Contact, ContactInput } from '@/data/types'
import { useOnline } from '@/pwa/useOnline'

/** 人脈新增／編輯抽屜 */
export function ContactEditor({ contact, onClose }: { contact: Contact | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const online = useOnline()
  const sources = useOptionSet('contact_source')
  const relations = useOptionSet('contact_relation')
  const contacts = useContacts()
  const clients = useClients()
  const links = useClientLinks()
  const m = useContactMutations()
  const c = contact
  const [f, setF] = useState<ContactInput>({
    name: c?.name ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    company: c?.company ?? '',
    job_title: c?.job_title ?? '',
    website: c?.website ?? '',
    instagram: c?.instagram ?? '',
    source_id: c?.source_id ?? null,
    referrer_contact_id: c?.referrer_contact_id ?? null,
    referrer_name: c?.referrer_name ?? '',
    relation_id: c?.relation_id ?? null,
    note: c?.note ?? '',
  })
  const initialLinks = (links.data ?? []).filter((l) => l.contact_id === c?.id).map((l) => l.client_id)
  const [clientIds, setClientIds] = useState<string[] | null>(null)
  const linked = clientIds ?? initialLinks
  const [pick, setPick] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const set = <K extends keyof ContactInput>(k: K, v: ContactInput[K]) => setF((x) => ({ ...x, [k]: v }))
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  const isReferral = sources.byId(f.source_id)?.key === 'referral'

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!f.name.trim()) return setErr('請輸入姓名')
    const b = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null)
    const input: ContactInput = {
      ...f,
      name: f.name.trim(),
      phone: b(f.phone),
      email: b(f.email),
      company: b(f.company),
      job_title: b(f.job_title),
      website: b(f.website),
      instagram: b(f.instagram),
      note: b(f.note),
      referrer_contact_id: isReferral ? f.referrer_contact_id : null,
      referrer_name: isReferral ? b(f.referrer_name) : null,
      client_id: linked[0] ?? null, // 主要關聯客戶（完整關聯存在 client_contacts）
    }
    setBusy(true)
    try {
      const id = c ? (await m.update.mutateAsync({ id: c.id, patch: input }), c.id) : (await m.create.mutateAsync(input)).id
      // 同步多對多關聯
      const before = new Set(c ? initialLinks : [])
      const after = new Set(linked)
      for (const cid of after) if (!before.has(cid)) await clientsRepo.link(cid, id)
      for (const cid of before) if (!after.has(cid)) await clientsRepo.unlink(cid, id)
      invalidateTable('client_contacts')
      onClose()
    } catch {
      /* 全域錯誤列 */
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label={c ? '編輯人脈' : '新增人脈'}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-[min(520px,100vw)] max-w-none overflow-hidden border-l border-line bg-surface p-0 text-text backdrop:bg-[var(--c-backdrop)] sm:rounded-l-[var(--r-2xl)]"
    >
      <form onSubmit={submit} className="flex h-full flex-col">
        <header className="flex items-center justify-between border-b border-line-soft px-6 py-4">
          <div>
            <p className="label-caps text-[11px] text-text-2">{c ? '編輯人脈' : '新增人脈'}</p>
            <h2 className="text-lg font-semibold">{f.name || '未命名'}</h2>
          </div>
          <Button variant="ghost" iconOnly size="sm" aria-label="關閉" onClick={onClose} icon={<X size={18} />} />
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
          <Input label="姓名" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus={!c} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="品牌／公司" value={f.company ?? ''} onChange={(e) => set('company', e.target.value)} />
            <Input label="職位" value={f.job_title ?? ''} onChange={(e) => set('job_title', e.target.value)} />
            <Input label="電話" value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
            <Input label="Email" value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} inputMode="email" />
            <Input label="網站" value={f.website ?? ''} onChange={(e) => set('website', e.target.value)} />
            <Input label="IG" value={f.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="認識管道" value={f.source_id ?? ''} onChange={(e) => set('source_id', e.target.value || null)}>
              <option value="">未設定</option>
              {sources.items.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Select label="與我的關係" value={f.relation_id ?? ''} onChange={(e) => set('relation_id', e.target.value || null)}>
              <option value="">未設定</option>
              {relations.items.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {isReferral && (
            <div className="card-inset grid gap-4 p-4 sm:grid-cols-2">
              <Select label="轉介人（既有人脈）" value={f.referrer_contact_id ?? ''} onChange={(e) => set('referrer_contact_id', e.target.value || null)}>
                <option value="">不指定</option>
                {(contacts.data ?? [])
                  .filter((x) => x.id !== c?.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </Select>
              <Input label="或填寫轉介人" value={f.referrer_name ?? ''} onChange={(e) => set('referrer_name', e.target.value)} />
            </div>
          )}
          <div>
            <p className="field-label">關聯客戶</p>
            <div className="flex flex-wrap gap-2">
              {linked.map((cid) => {
                const cl = clients.data?.find((x) => x.id === cid)
                return (
                  <span key={cid} className="chip">
                    <span className="tabular font-mono text-[11px] text-text-2">{cl?.code}</span> {cl?.name}
                    <button type="button" aria-label={`移除 ${cl?.name}`} onClick={() => setClientIds(linked.filter((x) => x !== cid))} className="-mr-1 grid size-5 place-items-center rounded-full hover:bg-surface-2">
                      <X size={12} />
                    </button>
                  </span>
                )
              })}
              {!linked.length && <span className="text-sm text-text-3">尚未關聯</span>}
            </div>
            <div className="mt-2 flex gap-2">
              <select className="input h-10 flex-1 text-sm" aria-label="選擇客戶" value={pick} onChange={(e) => setPick(e.target.value)}>
                <option value="">選擇客戶…</option>
                {(clients.data ?? [])
                  .filter((x) => !linked.includes(x.id))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.code} {x.name}
                    </option>
                  ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                className="h-10"
                disabled={!pick}
                onClick={() => {
                  setClientIds([...linked, pick])
                  setPick('')
                }}
              >
                加入
              </Button>
            </div>
          </div>
          <Textarea label="備註" value={f.note ?? ''} onChange={(e) => set('note', e.target.value)} />
          {err && <Alert tone="danger">{err}</Alert>}
        </div>
        <footer className="flex items-center gap-2 border-t border-line-soft px-6 py-4">
          {c && <Button variant="danger" size="sm" iconOnly aria-label="刪除人脈" disabled={!online} onClick={() => setConfirm(true)} icon={<Trash2 size={15} />} />}
          <div className="ml-auto flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="primary" bracket loading={busy} disabled={!online}>
              儲存
            </Button>
          </div>
        </footer>
      </form>
      <ConfirmDialog
        open={confirm}
        title={`確定要刪除「${c?.name ?? ''}」？`}
        onCancel={() => setConfirm(false)}
        onConfirm={async () => {
          setConfirm(false)
          if (!c) return
          await m.remove.mutateAsync(c.id)
          onClose()
        }}
      >
        與客戶的關聯會一起移除，客戶本身不受影響。
      </ConfirmDialog>
    </dialog>
  )
}
