import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 「[ 按鈕 ]」括號樣式 */
  bracket?: boolean
  icon?: ReactNode
  /** 只有圖示（需提供 aria-label） */
  iconOnly?: boolean
  loading?: boolean
  pressed?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  bracket = false,
  icon,
  iconOnly = false,
  loading = false,
  pressed,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'btn',
        `btn-${variant}`,
        size !== 'md' && `btn-${size}`,
        bracket && !iconOnly && 'btn-bracket',
        iconOnly && 'btn-icon',
        className,
      )}
      disabled={disabled || loading}
      data-pressed={pressed ? 'true' : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
      {!iconOnly && children}
    </button>
  )
}
