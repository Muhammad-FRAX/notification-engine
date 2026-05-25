import { cn } from '../../lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className, ...props }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 py-16 px-8 text-center',
        className
      )}
      {...props}
    >
      {Icon && (
        <div
          className="flex items-center justify-center w-10 h-10 rounded-lg bg-[var(--bg-elev-2)]"
        >
          <Icon size={20} className="text-[var(--text-subtle)]" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        {title && (
          <p className="text-sm font-medium text-[var(--text)]">{title}</p>
        )}
        {description && (
          <p className="text-xs text-[var(--text-subtle)] max-w-xs">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
