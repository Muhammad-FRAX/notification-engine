import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '../../lib/utils'

export function Label({ className, ...props }) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-xs font-medium text-[var(--text-muted)] leading-none select-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-40',
        className
      )}
      {...props}
    />
  )
}

export function FieldRow({ label, hint, children, className, ...props }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label && <Label>{label}</Label>}
      {children}
      {hint && (
        <p className="text-xs text-[var(--text-subtle)] leading-none">{hint}</p>
      )}
    </div>
  )
}
