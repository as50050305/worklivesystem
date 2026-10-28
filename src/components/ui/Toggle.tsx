import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label?: ReactNode }

function Wrap({ label, disabled, children }: { label?: ReactNode; disabled?: boolean; children: ReactNode }) {
  if (!label) return <>{children}</>
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5 text-sm', disabled && 'cursor-not-allowed text-text-3')}>
      {children}
      <span>{label}</span>
    </label>
  )
}

export function Checkbox({ label, className, ...rest }: Props) {
  return (
    <Wrap label={label} disabled={rest.disabled}>
      <input type="checkbox" className={cn('check', className)} {...rest} />
    </Wrap>
  )
}

export function Radio({ label, className, ...rest }: Props) {
  return (
    <Wrap label={label} disabled={rest.disabled}>
      <input type="radio" className={cn('radio', className)} {...rest} />
    </Wrap>
  )
}

export function Switch({ label, className, ...rest }: Props) {
  return (
    <Wrap label={label} disabled={rest.disabled}>
      <input type="checkbox" role="switch" className={cn('switch', className)} {...rest} />
    </Wrap>
  )
}
