import { cn } from '../../lib/utils'

export function Input({ className, type = 'text', ...props }) {
  return (
    <input
      type={type}
      className={cn(
        'h-[var(--input-h)] w-full px-2.5',
        'bg-[var(--bg-elev-2)] text-[var(--text)] text-sm font-sans',
        'border border-[var(--border)] rounded',
        'placeholder:text-[var(--text-subtle)]',
        'transition-[border-color,box-shadow] duration-[150ms]',
        'focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }) {
  return (
    <textarea
      className={cn(
        'w-full px-2.5 py-2',
        'bg-[var(--bg-elev-2)] text-[var(--text)] text-sm font-sans',
        'border border-[var(--border)] rounded',
        'placeholder:text-[var(--text-subtle)]',
        'resize-y min-h-[80px]',
        'transition-[border-color,box-shadow] duration-[150ms]',
        'focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]',
        'disabled:opacity-40 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
}
