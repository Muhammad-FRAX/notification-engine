import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-1.5',
    'font-sans font-medium leading-none select-none',
    'border border-transparent rounded',
    'transition-all duration-[150ms]',
    'cursor-pointer',
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-strong)]',
    'disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none',
    'whitespace-nowrap',
  ],
  {
    variants: {
      intent: {
        default: [
          'bg-[var(--bg-elev-2)] text-[var(--text)]',
          'border-[var(--border)]',
          'hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] hover:border-[var(--accent-soft)]',
        ],
        primary: [
          'bg-[var(--accent)] text-white',
          'hover:bg-[var(--accent-strong)]',
        ],
        ghost: [
          'bg-transparent text-[var(--text-muted)]',
          'hover:bg-[var(--accent-soft)] hover:text-[var(--text)]',
        ],
        danger: [
          'bg-transparent text-[var(--danger)]',
          'border-[var(--border)]',
          'hover:bg-[var(--danger-hover)] hover:border-[var(--danger-hover-border)]',
        ],
      },
      size: {
        sm: ['h-[var(--btn-h-sm)] px-[var(--btn-padding-x)] text-xs rounded-[var(--radius-sm)]'],
        default: ['h-[var(--btn-h)] px-[var(--btn-padding-x)] text-sm'],
        lg: ['h-[var(--btn-h-lg)] px-3 text-sm'],
      },
    },
    defaultVariants: {
      intent: 'default',
      size: 'default',
    },
  }
)

export function Button({ className, intent, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ intent, size }), className)}
      {...props}
    />
  )
}

export function IconButton({ className, size = 'default', intent = 'ghost', style: styleProp, ...props }) {
  const h = size === 'sm' ? 'var(--btn-h-sm)' : size === 'lg' ? 'var(--btn-h-lg)' : 'var(--btn-h)'
  return (
    <Button
      intent={intent}
      size={size}
      className={cn('px-0', className)}
      style={{ width: h, ...styleProp }}
      {...props}
    />
  )
}
