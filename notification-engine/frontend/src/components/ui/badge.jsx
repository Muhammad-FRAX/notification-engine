import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  [
    'inline-flex items-center gap-1 px-2 h-5',
    'text-xs font-medium leading-none rounded-full font-tabular',
    'border whitespace-nowrap select-none',
  ],
  {
    variants: {
      variant: {
        default:  'bg-[var(--bg-elev-2)] border-[var(--border)] text-[var(--text-muted)]',
        sent:     'bg-[var(--success-soft)] border-[var(--success-border)] text-[var(--success)]',
        partial:  'bg-[var(--warning-soft)] border-[var(--warning-border)] text-[var(--warning)]',
        failed:   'bg-[var(--danger-soft)] border-[var(--danger-border)] text-[var(--danger)]',
        unrouted: 'bg-[var(--bg-elev-2)] border-[var(--border)] text-[var(--text-subtle)]',
        retrying: 'bg-[var(--accent-soft)] border-[var(--accent-soft)] text-[var(--accent)]',
        queued:   'bg-[var(--bg-elev-2)] border-[var(--border)] text-[var(--text-muted)]',
        sending:  'bg-[var(--accent-soft)] border-[var(--accent-soft)] text-[var(--accent)]',
        active:   'bg-[var(--success-soft)] border-[var(--success-border)] text-[var(--success)]',
        inactive: 'bg-[var(--bg-elev-2)] border-[var(--border)] text-[var(--text-subtle)]',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

export function Badge({ className, variant, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export function StatusBadge({ status, ...props }) {
  const label = status ?? 'unknown'
  return (
    <Badge variant={label} {...props}>
      {label}
    </Badge>
  )
}
