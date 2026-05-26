import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogPortal = DialogPrimitive.Portal
export const DialogClose = DialogPrimitive.Close

export function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
        className
      )}
      {...props}
    />
  )
}

export function DialogContent({ className, children, ...props }) {
  // Opt out of Radix's a11y description warning when no DialogDescription is provided.
  // Callers can still set aria-describedby explicitly to override.
  const ariaProps = 'aria-describedby' in props ? {} : { 'aria-describedby': undefined }
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-lg',
          'bg-[var(--bg-elev)] border border-[var(--border)] rounded-lg shadow-xl',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'focus:outline-none',
          className
        )}
        {...ariaProps}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className={cn(
            'absolute right-3 top-3 rounded-[var(--radius-sm)]',
            'text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--bg-elev-2)]',
            'transition-colors duration-[150ms]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]',
            'p-1',
          )}
        >
          <X size={14} />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn('flex flex-col gap-1 px-4 py-3 border-b border-[var(--border)]', className)}
      {...props}
    />
  )
}

export function DialogTitle({ className, ...props }) {
  return (
    <DialogPrimitive.Title
      className={cn('text-sm font-semibold text-[var(--text)] leading-none', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }) {
  return (
    <DialogPrimitive.Description
      className={cn('text-xs text-[var(--text-subtle)]', className)}
      {...props}
    />
  )
}

export function DialogBody({ className, ...props }) {
  return (
    <div className={cn('px-4 py-4', className)} {...props} />
  )
}

export function DialogFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--border)]',
        className
      )}
      {...props}
    />
  )
}
