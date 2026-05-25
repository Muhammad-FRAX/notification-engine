import { useState } from 'react'
import { api } from '../lib/api'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { FieldRow } from '../components/ui/label'
import { Spinner } from '../components/ui/spinner'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!form.username || !form.password) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/admin/auth/login', form)
      localStorage.setItem('admin_token', res.token)
      window.location.href = '/'
    } catch (err) {
      setError(err.message ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: 'var(--bg-elev)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '32px 28px',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--text)',
              lineHeight: '24px',
            }}
          >
            Notification Engine
          </h1>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 13,
              color: 'var(--text-muted)',
              lineHeight: '18px',
            }}
          >
            Sign in to the admin panel
          </p>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FieldRow label="Username">
            <Input
              autoFocus
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              autoComplete="username"
              disabled={loading}
            />
          </FieldRow>
          <FieldRow label="Password">
            <Input
              type="password"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              autoComplete="current-password"
              disabled={loading}
            />
          </FieldRow>

          {error && (
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: 'var(--danger)',
                lineHeight: '16px',
              }}
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            intent="primary"
            style={{ width: '100%' }}
            disabled={!form.username || !form.password || loading}
          >
            {loading ? <Spinner size={12} /> : null}
            Sign In
          </Button>
        </form>
      </div>
    </div>
  )
}
