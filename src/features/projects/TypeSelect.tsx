import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { Button, Select } from '@/components/ui'
import { useOptionSet, useProjectTypeMutations } from '@/data/projectHooks'

const NEW = '__new__'

/** 專案類型下拉選單；最後一個選項「＋ 新增類型…」可直接建立新類型 */
export function TypeSelect({
  label = '類型',
  value,
  onChange,
  help,
  disabled,
  allowEmpty,
  emptyLabel = '（未設定類型）',
}: {
  label?: string
  value: string
  onChange: (id: string) => void
  help?: string
  disabled?: boolean
  allowEmpty?: boolean
  emptyLabel?: string
}) {
  const types = useOptionSet('project_type')
  const m = useProjectTypeMutations()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const create = async () => {
    const n = name.trim()
    if (!n) return
    const existing = types.items.find((t) => t.label === n)
    const id = existing ? existing.id : (await m.create.mutateAsync({ label: n, sortOrder: types.items.length + 1 })).id
    onChange(id)
    setAdding(false)
    setName('')
  }

  if (adding)
    return (
      <div>
        <p className="field-label">{label}</p>
        <div className="flex gap-2">
          <input
            className="input min-w-0 flex-1"
            aria-label="新類型名稱"
            placeholder="新類型名稱，例如：個展"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void create()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                setAdding(false)
              }
            }}
          />
          <Button variant="secondary" icon={<Plus size={14} />} loading={m.create.isPending} disabled={!name.trim()} onClick={() => void create()}>
            建立
          </Button>
          <Button variant="ghost" iconOnly aria-label="取消新增類型" icon={<X size={14} />} onClick={() => setAdding(false)} />
        </div>
        <p className="field-help">新類型還沒有階段，可到 設定 → 專案類型與階段 設定。</p>
      </div>
    )

  return (
    <Select
      label={label}
      value={value}
      disabled={disabled}
      help={help}
      onChange={(e) => {
        if (e.target.value === NEW) return setAdding(true)
        onChange(e.target.value)
      }}
    >
      {(allowEmpty || !value) && <option value="">{emptyLabel}</option>}
      {types.items.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
      <option value={NEW}>＋ 新增類型…</option>
    </Select>
  )
}
