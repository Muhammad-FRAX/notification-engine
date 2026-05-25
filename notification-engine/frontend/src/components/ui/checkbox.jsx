import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

export function Checkbox({ className, ...props }) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer h-4 w-4 shrink-0 rounded-[4px]',
        'border border-[var(--border)] bg-[var(--bg-elev-2)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-strong)] focus-visible:outline-offset-2',
        'data-[state=checked]:bg-[var(--accent)] data-[state=checked]:border-[var(--accent)] data-[state=checked]:text-white',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'transition-colors duration-[150ms]',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check size={10} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
