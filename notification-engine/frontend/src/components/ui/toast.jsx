import * as ToastPrimitive from '@radix-ui/react-toast'
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { createContext, useContext, useState, useCallback } from 'react'
import { cn } from '../../lib/utils'

const ToastContext = createContext(null)

let toastId = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(({ title, description, variant = 'default', duration = 4000 }) => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, title, description, variant, duration }])
    return id
  }, [])

  const dismiss = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map(t => (
          <ToastPrimitive.Root
            key={t.id}
            duration={t.duration}
            onOpenChange={open => { if (!open) dismiss(t.id) }}
            className={cn(
              'group relative flex items-start gap-3 p-3 pr-8',
              'bg-[var(--bg-elev-2)] border border-[var(--border)] rounded-lg shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full data-[state=open]:fade-in-0',
              'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=closed]:fade-out-0',
              'transition-all duration-[180ms]',
            )}
          >
            <ToastIcon variant={t.variant} />
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              {t.title && (
                <ToastPrimitive.Title className="text-sm font-medium text-[var(--text)] leading-snug">
                  {t.title}
                </ToastPrimitive.Title>
              )}
              {t.description && (
                <ToastPrimitive.Description className="text-xs text-[var(--text-muted)]">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close
              className={cn(
                'absolute right-2 top-2 rounded p-0.5',
                'text-[var(--text-subtle)] hover:text-[var(--text)] hover:bg-[var(--bg-elev)]',
                'transition-colors duration-[150ms]',
                'opacity-0 group-hover:opacity-100 focus:opacity-100',
                'focus:outline-none focus:ring-2 focus:ring-[var(--accent-strong)]',
              )}
            >
              <X size={12} />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport
          className={cn(
            'fixed bottom-4 right-4 z-[100]',
            'flex flex-col gap-2 w-80 max-w-[calc(100vw-32px)]',
          )}
        />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

function ToastIcon({ variant }) {
  const cls = 'shrink-0 mt-0.5'
  if (variant === 'success') return <CheckCircle2 size={14} className={cn(cls, 'text-[var(--success)]')} />
  if (variant === 'error')   return <AlertCircle  size={14} className={cn(cls, 'text-[var(--danger)]')} />
  if (variant === 'info')    return <Info          size={14} className={cn(cls, 'text-[var(--accent)]')} />
  return null
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be inside ToastProvider')
  return ctx
}
