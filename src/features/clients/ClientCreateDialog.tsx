import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Input } from '@/components/ui'
import { useClientMutations } from '@/data/clientHooks'
import { useOptionSet } from '@/data/projectHooks'
import { useOnline } from '@/pwa/useOnline'

export function ClientCreateDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const nav = useNavigate()
  const online = useOnline()
  const sales = useOptionSet('sales_stage')
  const coop = useOptionSet('cooperation_status')
  const { create } = useClientMutations()
  const [f, setF] = useState({ name: '', code: '', phone: '', email: '', instagram: '', website: '' })
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!f.name.trim()) return setErr('請輸入品牌名稱')
    const b = (s: string) => s.trim() || null
    try {
      const c = await create.mutateAsync({
        name: f.name.trim(),
        code: f.code.trim() || undefined,
        phone: b(f.phone),
        email: b(f.email),
        instagram: b(f.instagram),
        website: b(f.website),
        sales_stage_id: sales.byKey('first_contact')?.id ?? null,
        cooperation_status_id: coop.byKey('unset')?.id ?? null,
      })
      onClose()
      nav(`/clients/${c.id}`)
    } catch {
      /* 全域錯誤列（例如編號重複） */
    }
  }
  return (
    <dialog
      ref={ref}
      aria-label="新增客戶"
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      className="card elev-2 m-auto max-h-[calc(100dvh-32px)] w-[min(560px,calc(100vw-32px))] overflow-y-auto p-6 text-text backdrop:bg-[var(--c-backdrop)] sm:p-8"
    >
      <form onSubmit={submit} className="space-y-4">
        <h2 className="text-xl font-semibold">新增客戶</h2>
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <Input label="品牌名稱" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          <Input label="編號" value={f.code} onChange={(e) => set('code', e.target.value)} placeholder="自動" className="font-mono" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="手機" value={f.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" />
          <Input label="Email" value={f.email} onChange={(e) => set('email', e.target.value)} inputMode="email" />
          <Input label="IG" value={f.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@account" />
          <Input label="網站" value={f.website} onChange={(e) => set('website', e.target.value)} />
        </div>
        <p className="text-xs text-text-3">編號留空會自動產生（C001、C002…），之後可修改但不可重複。</p>
        {err && <Alert tone="danger">{err}</Alert>}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" variant="primary" bracket loading={create.isPending} disabled={!online}>
            建立
          </Button>
        </div>
      </form>
    </dialog>
  )
}
