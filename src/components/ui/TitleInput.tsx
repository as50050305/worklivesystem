import { useEffect, useLayoutEffect, useRef, useState, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'rows'> & {
  value: string
  /** 失焦或按 Enter 時呼叫；空白時還原 */
  onCommit: (v: string) => void
  allowEmpty?: boolean
}

/**
 * 頁面大標題的就地編輯：會自動換行、自動長高（長名稱在手機上不被截斷），
 * Enter 儲存（不換行），Esc 還原。
 */
export function TitleInput({ value, onCommit, allowEmpty = false, className, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const fit = () => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }
  useLayoutEffect(fit, [draft])
  useEffect(() => {
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={1}
      value={draft}
      className={cn('block w-full resize-none overflow-hidden rounded-lg bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]', className)}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
        if (e.key === 'Escape') setDraft(value)
      }}
      onBlur={() => {
        const v = draft.trim()
        if (!v && !allowEmpty) return setDraft(value)
        if (v !== value) onCommit(v)
        else setDraft(value)
      }}
    />
  )
}
