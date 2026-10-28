import { useState } from 'react'
import { Card } from '@/components/ui'
import { useOptionMutations, useOptionSet } from '@/data/projectHooks'
import type { OptionCategory } from '@/data/types'
import { cn } from '@/lib/cn'
import { OrderedListEditor } from './OrderedListEditor'

export const CATEGORY_LABEL: Record<OptionCategory, string> = {
  project_type: '專案類型',
  project_status: '專案狀態',
  collection_type: '收藏類型',
  collection_status: '收藏狀態',
  sales_stage: '銷售流程',
  cooperation_status: '合作狀態',
  followup_status: '追蹤狀態',
  quote_status: '報價單狀態',
  contact_source: '認識管道',
  contact_relation: '與我的關係',
  followup_method: '追蹤方式',
  currency: '幣別',
}

const ORDER = Object.keys(CATEGORY_LABEL) as OptionCategory[]

function CategoryEditor({ category }: { category: OptionCategory }) {
  const set = useOptionSet(category)
  const m = useOptionMutations()
  return (
    <OrderedListEditor
      rows={set.items.map((o) => ({ id: o.id, label: o.label, locked: o.key !== null }))}
      onRename={(id, label) => m.rename.mutate({ id, label })}
      onReorder={(ids) => m.reorder.mutate(ids)}
      onDelete={(id) => m.remove.mutateAsync(id).catch(() => {})}
      onAdd={(label) => m.create.mutateAsync({ category, label, sortOrder: set.items.length + 1 })}
      addPlaceholder={`新增${CATEGORY_LABEL[category]}`}
      deleteHint="若仍有資料使用這個選項，刪除會失敗，請先把那些資料改成其他選項。"
    />
  )
}

export function OptionsSection() {
  const [cat, setCat] = useState<OptionCategory>('project_type')
  return (
    <Card title="選項表">
      <p className="-mt-2 mb-5 text-sm text-text-2">
        所有類型、狀態、階段類選項都可以新增、改名、排序。帶鎖頭的是系統選項，自動化規則會用到（例如「No show」「成交」「不合」），可改名但不可刪除。
      </p>
      <div className="grid gap-6 md:grid-cols-[200px_1fr]">
        <nav aria-label="選項分類" className="flex flex-wrap gap-1 md:flex-col">
          {ORDER.map((c) => (
            <button
              key={c}
              type="button"
              aria-current={c === cat ? 'true' : undefined}
              onClick={() => setCat(c)}
              className={cn('rounded-lg px-3 py-2 text-left text-sm', c === cat ? 'bg-primary text-on-primary' : 'text-text-2 hover:bg-surface-2 hover:text-text')}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </nav>
        <div>
          <h3 className="label-caps mb-3 text-[12px]">{CATEGORY_LABEL[cat]}</h3>
          <CategoryEditor key={cat} category={cat} />
        </div>
      </div>
    </Card>
  )
}
