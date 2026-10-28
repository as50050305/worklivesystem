import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

/** 二次確認對話框（刪除前使用） */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = '確認刪除',
  cancelLabel = '取消',
  danger = true,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault()
        onCancel()
      }}
      className="card elev-2 m-auto w-[min(420px,calc(100vw-32px))] overflow-visible p-6 text-text backdrop:bg-[var(--c-backdrop)]"
    >
      <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
      {children && <div className="mt-2 text-sm text-text-2">{children}</div>}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} bracket onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  )
}
