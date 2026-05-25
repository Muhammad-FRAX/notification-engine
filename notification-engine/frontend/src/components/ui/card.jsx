import { cn } from '../../lib/utils'

export function Card({ className, ...props }) {
  return (
    <div
      className={cn(
        'bg-[var(--bg-elev)] border border-[var(--border)] rounded-lg',
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 px-4 py-3 border-b border-[var(--border)]',
        className
      )}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }) {
  return (
    <h3
      className={cn('text-sm font-semibold text-[var(--text)] leading-none', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }) {
  return (
    <p
      className={cn('text-xs text-[var(--text-subtle)]', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }) {
  return (
    <div className={cn('p-4', className)} {...props} />
  )
}

export function CardFooter({ className, ...props }) {
  return (
    <div
      className={cn(
        'flex items-center px-4 py-3 border-t border-[var(--border)]',
        className
      )}
      {...props}
    />
  )
}

export function Section({ title, description, className, children, actions, ...props }) {
  return (
    <section className={cn('flex flex-col gap-3', className)} {...props}>
      {(title || description || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            {title && (
              <h2 className="text-lg font-semibold text-[var(--text)] leading-tight">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-[var(--text-muted)]">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export function Divider({ className, ...props }) {
  return (
    <hr
      className={cn('border-0 border-t border-[var(--border)]', className)}
      {...props}
    />
  )
}
