import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '../../lib/utils'

export function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full',
        'border-2 border-transparent',
        'bg-[var(--bg-elev-2)]',
        'transition-colors duration-[150ms]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-strong)] focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'data-[state=checked]:bg-[var(--accent)]',
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm',
          'ring-0 transition-transform duration-[150ms]',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
        )}
      />
    </SwitchPrimitive.Root>
  )
}
