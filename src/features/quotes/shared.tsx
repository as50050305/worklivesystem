import { useEffect, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Badge, type BadgeTone } from '@/components/ui'
import type { Client, OptionItem, Quote } from '@/data/types'
import { cn } from '@/lib/cn'
import { quoteNumber } from '@/lib/quotes'

export function quoteStatusTone(o: OptionItem | undefined): BadgeTone {
  switch (o?.key) {
    case 'draft':
      return 'neutral'
    case 'sent':
      return 'steel'
    case 'won':
      return 'primary'
    case 'lost':
      return 'danger'
    default:
      return 'lavender'
  }
}

export function QuoteStatusBadge({ option }: { option: OptionItem | undefined }) {
  return <Badge tone={quoteStatusTone(option)}>{option?.label ?? '未設定'}</Badge>
}

export function quoteNo(q: Pick<Quote, 'version'>, client: Pick<Client, 'code'> | null | undefined): string {
  return quoteNumber(client?.code, q.version)
}

/** 解析使用者輸入的數字：可含千分位逗號；空白回傳 null */
export function parseNumber(s: string): number | null {
  const t = s.replace(/[,，\s]/g, '')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

type DraftInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (v: string) => void
}

/** 先在本地編輯，失焦或按 Enter 才儲存（避免每打一個字就寫入資料庫） */
export function DraftInput({ value, onCommit, className, ...rest }: DraftInputProps) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return (
    <input
      {...rest}
      className={cn('input', className)}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onCommit(draft)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') setDraft(value)
      }}
    />
  )
}

type DraftTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onCommit: (v: string) => void
}

export function DraftTextarea({ value, onCommit, className, ...rest }: DraftTextareaProps) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  return <textarea {...rest} className={cn('input', className)} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== value && onCommit(draft)} />
}
