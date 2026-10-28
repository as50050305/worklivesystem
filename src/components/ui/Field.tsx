import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface FieldProps {
  label?: ReactNode
  help?: ReactNode
  error?: ReactNode
  className?: string
  children: (id: string, describedBy: string | undefined, invalid: boolean) => ReactNode
}

/** 表單欄位外框：標籤、說明、錯誤訊息 */
export function Field({ label, help, error, className, children }: FieldProps) {
  const id = useId()
  const descId = error || help ? `${id}-desc` : undefined
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
        </label>
      )}
      {children(id, descId, Boolean(error))}
      {error ? (
        <p id={descId} className="field-error">
          {error}
        </p>
      ) : help ? (
        <p id={descId} className="field-help">
          {help}
        </p>
      ) : null}
    </div>
  )
}

type Common = { label?: ReactNode; help?: ReactNode; error?: ReactNode; wrapperClassName?: string }

export function Input({ label, help, error, wrapperClassName, className, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} help={help} error={error} className={wrapperClassName}>
      {(id, desc, invalid) => (
        <input id={id} aria-describedby={desc} aria-invalid={invalid || undefined} className={cn('input', className)} {...rest} />
      )}
    </Field>
  )
}

export function Textarea({ label, help, error, wrapperClassName, className, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} help={help} error={error} className={wrapperClassName}>
      {(id, desc, invalid) => (
        <textarea id={id} aria-describedby={desc} aria-invalid={invalid || undefined} className={cn('input', className)} {...rest} />
      )}
    </Field>
  )
}

export function Select({
  label,
  help,
  error,
  wrapperClassName,
  className,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} help={help} error={error} className={wrapperClassName}>
      {(id, desc, invalid) => (
        <select id={id} aria-describedby={desc} aria-invalid={invalid || undefined} className={cn('input', className)} {...rest}>
          {children}
        </select>
      )}
    </Field>
  )
}
