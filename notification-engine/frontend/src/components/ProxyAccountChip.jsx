import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export function ProxyAccountChip() {
  const [account, setAccount] = useState(null)

  useEffect(() => {
    api.get('/admin/proxy-account').then(setAccount).catch(() => {})
  }, [])

  const signed = account?.status === 'signed_in'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px',
        height: 26,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border)',
        fontSize: 12,
        color: signed ? 'var(--text-muted)' : 'var(--text-subtle)',
        fontFamily: 'var(--font-mono)',
        background: 'var(--bg-elev)',
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: signed ? 'var(--success)' : 'var(--text-subtle)',
          flexShrink: 0,
        }}
      />
      {signed ? account.upn : 'Not signed in'}
    </div>
  )
}
