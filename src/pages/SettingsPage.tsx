import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Alert, Badge, Button, Card, ConfirmDialog, EmptyState, Input, Switch, Tabs } from '@/components/ui'
import { BoxIllustration } from '@/components/illustrations/Illustrations'
import { useColorTagMutations, useColorTags } from '@/data/hooks'
import type { ColorTag } from '@/data/types'
import { appVersion } from '@/lib/env'
import { OptionsSection } from '@/features/settings/OptionsSection'
import { TemplatesSection } from '@/features/settings/TemplatesSection'
import { useTheme } from '@/lib/ThemeContext'
import { useOnline } from '@/pwa/useOnline'

type Tab = 'tags' | 'appearance' | 'options' | 'templates' | 'contracts' | 'backup' | 'security'

const TABS: { value: Tab; label: string; phase?: string }[] = [
  { value: 'tags', label: '顏色標籤' },
  { value: 'appearance', label: '外觀' },
  { value: 'options', label: '選項表' },
  { value: 'templates', label: '階段模板' },
  { value: 'contracts', label: '合約模板', phase: 'P6' },
  { value: 'backup', label: '匯出／匯入', phase: 'P7' },
  { value: 'security', label: '安全與版本' },
]

const HEX = /^#[0-9A-Fa-f]{6}$/

function TagRow({ tag, index, total, onMove, onDelete }: { tag: ColorTag; index: number; total: number; onMove: (dir: -1 | 1) => void; onDelete: () => void }) {
  const { update } = useColorTagMutations()
  const online = useOnline()
  const [name, setName] = useState(tag.name)
  const [hex, setHex] = useState(tag.color.toUpperCase())
  useEffect(() => setName(tag.name), [tag.name])
  useEffect(() => setHex(tag.color.toUpperCase()), [tag.color])

  const saveName = () => {
    const n = name.trim()
    if (!n) return setName(tag.name)
    if (n !== tag.name) update.mutate({ id: tag.id, patch: { name: n } })
  }
  const saveColor = (c: string) => {
    const v = c.toUpperCase()
    setHex(v)
    if (HEX.test(v) && v !== tag.color.toUpperCase()) update.mutate({ id: tag.id, patch: { color: v } })
  }

  return (
    <li className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 border-b border-dashed border-line-soft py-4 last:border-0 sm:grid-cols-[auto_1fr_120px_auto_auto]">
      <label className="relative size-10 cursor-pointer overflow-hidden rounded-full border border-line" style={{ background: HEX.test(hex) ? hex : tag.color }} title="選擇顏色">
        <input type="color" value={HEX.test(hex) ? hex : tag.color} disabled={!online} onChange={(e) => saveColor(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={`${tag.name} 的顏色`} />
      </label>
      <div className="flex min-w-0 items-center gap-2">
        <input className="input h-10 min-w-0" value={name} disabled={!online} aria-label="標籤名稱" onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
        {tag.is_default && <Badge>預設</Badge>}
      </div>
      <input
        className="input tabular h-10 font-mono text-sm uppercase max-sm:col-start-2"
        value={hex}
        disabled={!online}
        aria-label="色碼"
        aria-invalid={!HEX.test(hex) || undefined}
        onChange={(e) => setHex(e.target.value)}
        onBlur={() => (HEX.test(hex) ? saveColor(hex) : setHex(tag.color.toUpperCase()))}
      />
      <div className="max-sm:col-start-2">
        <Switch label="列入生活代辦" checked={tag.is_life_todo} disabled={!online} onChange={(e) => update.mutate({ id: tag.id, patch: { is_life_todo: e.target.checked } })} />
      </div>
      <div className="flex items-center gap-1 max-sm:col-start-2">
        <Button variant="ghost" size="sm" iconOnly aria-label="上移" disabled={index === 0 || !online} onClick={() => onMove(-1)} icon={<ArrowUp size={15} />} />
        <Button variant="ghost" size="sm" iconOnly aria-label="下移" disabled={index === total - 1 || !online} onClick={() => onMove(1)} icon={<ArrowDown size={15} />} />
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={tag.is_default ? '預設標籤不可刪除' : '刪除'}
          title={tag.is_default ? '預設標籤不可刪除' : '刪除'}
          disabled={tag.is_default || !online}
          onClick={onDelete}
          icon={<Trash2 size={15} />}
        />
      </div>
    </li>
  )
}

function ColorTagsSection() {
  const { data: tags = [], isLoading } = useColorTags()
  const { create, reorder, remove } = useColorTagMutations()
  const online = useOnline()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#7EA2AA')
  const [toDelete, setToDelete] = useState<ColorTag | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) return setErr('請輸入名稱')
    if (!HEX.test(color)) return setErr('色碼格式為 #RRGGBB')
    await create.mutateAsync({ input: { name: name.trim(), color: color.toUpperCase() }, sortOrder: tags.length })
    setName('')
  }
  const move = (i: number, dir: -1 | 1) => {
    const ids = tags.map((t) => t.id)
    const j = i + dir
    ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
    reorder.mutate(ids)
  }

  return (
    <Card title="顏色標籤">
      <p className="-mt-2 mb-4 text-sm text-text-2">用於時間軸、專案與篩選。「列入生活代辦」的標籤，項目會顯示在側邊欄的生活代辦（今天到期與逾期未完成）。</p>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-10" />
          ))}
        </div>
      ) : (
        <ul>
          {tags.map((t, i) => (
            <TagRow key={t.id} tag={t} index={i} total={tags.length} onMove={(d) => move(i, d)} onDelete={() => setToDelete(t)} />
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-4 flex flex-wrap items-end gap-3 border-t border-line-soft pt-5">
        <label className="relative size-10 flex-none cursor-pointer overflow-hidden rounded-full border border-line" style={{ background: HEX.test(color) ? color : 'transparent' }}>
          <input type="color" value={HEX.test(color) ? color : '#7EA2AA'} onChange={(e) => setColor(e.target.value.toUpperCase())} className="absolute inset-0 cursor-pointer opacity-0" aria-label="新標籤顏色" />
        </label>
        <Input label="新標籤名稱" value={name} onChange={(e) => setName(e.target.value)} wrapperClassName="min-w-40 flex-1" placeholder="例如：家人" />
        <Input label="色碼" value={color} onChange={(e) => setColor(e.target.value)} wrapperClassName="w-32" className="tabular font-mono uppercase" />
        <Button type="submit" variant="primary" icon={<Plus size={15} />} loading={create.isPending} disabled={!online}>
          新增
        </Button>
      </form>
      {err && <Alert tone="danger" className="mt-3">{err}</Alert>}

      <ConfirmDialog
        open={toDelete !== null}
        title={`確定要刪除「${toDelete?.name ?? ''}」？`}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) remove.mutate(toDelete.id)
          setToDelete(null)
        }}
      >
        使用這個標籤的項目會改為「未分類」。
      </ConfirmDialog>
    </Card>
  )
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  return (
    <Card title="外觀">
      <p className="mb-4 text-sm text-text-2">主題會同步到你所有的裝置。</p>
      <Tabs
        items={[
          { value: 'dark', label: '深色' },
          { value: 'light', label: '淺色（米白紙感）' },
        ]}
        value={theme}
        onChange={setTheme}
        className="max-w-sm"
      />
    </Card>
  )
}

function SecuritySection() {
  return (
    <Card title="安全與版本">
      <Alert tone="warning" title="免登入模式">
        這個 App 不需要登入，因此任何知道網址的人都能看到並修改你的資料（前端也會帶著 Supabase 的公開 key）。
      </Alert>
      <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-text-2">
        <li>不要把網址貼到公開的地方；Vercel 的網址可以改成不容易猜到的名稱。</li>
        <li>定期使用「匯出／匯入」備份（P7 完成）；Supabase 免費方案也有每日備份。</li>
        <li>資料庫已限制只能存取這個 App 的資料，並禁止一次清空整張表（TRUNCATE）。</li>
        <li>日後想加回保護，可以改回 Email＋密碼登入，或在 Vercel／Cloudflare 前面加一道網站密碼，資料不需要搬移。</li>
      </ul>
      <dl className="mt-6 grid grid-cols-[100px_1fr] gap-y-3 border-t border-dashed border-line-soft pt-5 text-sm">
        <dt className="text-text-2">版本</dt>
        <dd className="tabular font-mono">v{appVersion}</dd>
      </dl>
    </Card>
  )
}

export function SettingsPage() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.value === params.get('tab')) ? params.get('tab') : 'tags') as Tab
  const meta = TABS.find((t) => t.value === tab)!
  return (
    <>
      <PageHeader title="設定" eyebrow="Settings" />
      <Tabs ariaLabel="設定分類" items={TABS.map((t) => ({ value: t.value, label: t.label }))} value={tab} onChange={(v) => setParams({ tab: v }, { replace: true })} className="mb-8" />
      <div className="max-w-4xl">
        {tab === 'tags' && <ColorTagsSection />}
        {tab === 'appearance' && <AppearanceSection />}
        {tab === 'options' && <OptionsSection />}
        {tab === 'templates' && <TemplatesSection />}
        {tab === 'security' && <SecuritySection />}
        {meta.phase && (
          <Card>
            <EmptyState illustration={<BoxIllustration />} title={`${meta.label}將在 ${meta.phase} 完成`} />
          </Card>
        )}
      </div>
    </>
  )
}
