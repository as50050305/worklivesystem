import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { isSameMonth, monthGrid, parseDateInput, shiftAnchor, WEEKDAY_HEADERS } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { formatDate, todayTaipei, type PlainDate } from '@/lib/dates'

/**
 * 日期選擇器：固定顯示 YYYY/MM/DD、週一開頭（不受瀏覽器語系影響）
 * 可直接輸入 2026/10/28、2026-10-28 或 20261028
 */
export function DatePicker({
  label,
  value,
  onChange,
  allowEmpty = false,
  disabled,
  className,
}: {
  label?: string
  value: PlainDate | null
  onChange: (v: PlainDate | null) => void
  allowEmpty?: boolean
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  const [text, setText] = useState(formatDate(value))
  const [invalid, setInvalid] = useState(false)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState<PlainDate>(value ?? todayTaipei())
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setText(formatDate(value))
    setInvalid(false)
    if (value) setMonth(value)
  }, [value])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const commit = () => {
    if (!text.trim()) {
      if (allowEmpty) {
        onChange(null)
        setInvalid(false)
      } else {
        setText(formatDate(value))
      }
      return
    }
    const d = parseDateInput(text)
    if (!d) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (d !== value) onChange(d)
    setText(formatDate(d))
  }

  const today = todayTaipei()
  const pick = (d: PlainDate) => {
    onChange(d)
    setOpen(false)
  }

  return (
    <div ref={wrap} className={cn('relative', className)}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={id}
          className="input tabular pr-11 font-mono"
          value={text}
          placeholder="YYYY/MM/DD"
          inputMode="numeric"
          disabled={disabled}
          aria-invalid={invalid || undefined}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
        />
        <button
          type="button"
          disabled={disabled}
          aria-label="開啟月曆"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-text-2 hover:bg-surface-2 hover:text-text"
        >
          <CalendarDays size={16} strokeWidth={1.5} />
        </button>
      </div>
      {invalid && <p className="field-error">請輸入有效日期，例如 2026/10/28</p>}

      {open && (
        <div role="dialog" aria-label="選擇日期" className="card elev-1 absolute left-0 z-50 mt-2 w-[296px] p-4">
          <div className="mb-3 flex items-center justify-between">
            <button type="button" aria-label="上個月" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setMonth(shiftAnchor('month', month, -1))}>
              <ChevronLeft size={16} />
            </button>
            <span className="tabular font-mono text-sm font-semibold">
              {month.slice(0, 4)} / {month.slice(5, 7)}
            </span>
            <button type="button" aria-label="下個月" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2" onClick={() => setMonth(shiftAnchor('month', month, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAY_HEADERS.map((w) => (
              <span key={w} className="pb-1 font-mono text-[11px] text-text-3">
                {w}
              </span>
            ))}
            {monthGrid(month).flat().map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => pick(d)}
                aria-label={formatDate(d)}
                aria-current={d === today ? 'date' : undefined}
                className={cn(
                  'tabular grid h-8 place-items-center rounded-full font-mono text-[13px]',
                  !isSameMonth(d, month) && 'text-text-3',
                  d === value ? 'bg-primary text-on-primary' : 'hover:bg-surface-2',
                  d === today && d !== value && 'border border-primary-ink',
                )}
              >
                {Number(d.slice(8))}
              </button>
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-dashed border-line-soft pt-3">
            <button type="button" className="text-sm text-primary-ink hover:underline" onClick={() => pick(today)}>
              今天
            </button>
            {allowEmpty && (
              <button
                type="button"
                className="text-sm text-text-2 hover:underline"
                onClick={() => {
                  onChange(null)
                  setOpen(false)
                }}
              >
                清除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
