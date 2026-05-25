import { useEffect, useState } from 'react'
import { LogIn, LogOut, RefreshCw } from 'lucide-react'
import { Section, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'
import { api } from '../lib/api'

export default function Settings() {
  const { toast } = useToast()
  const [account, setAccount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [deviceCode, setDeviceCode] = useState(null)

  async function loadAccount() {
    setLoading(true)
    try {
      const d = await api.get('/admin/proxy-account')
      setAccount(d)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { loadAccount() }, [])

  async function startSignIn() {
    setSigning(true)
    setDeviceCode(null)
    try {
      const res = await api.post('/admin/proxy-account/sign-in')
      setDeviceCode(res)
      toast({ title: 'Device code ready — sign in via the URL shown', variant: 'info' })
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        if (attempts > 60) { clearInterval(poll); setSigning(false); return }
        try {
          const d = await api.get('/admin/proxy-account')
          if (d.status === 'signed_in') {
            clearInterval(poll)
            setAccount(d)
            setDeviceCode(null)
            setSigning(false)
            toast({ title: `Signed in as ${d.upn}`, variant: 'success' })
          }
        } catch { }
      }, 5000)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
      setSigning(false)
    }
  }

  async function signOut() {
    try {
      await api.post('/admin/proxy-account/sign-out')
      await loadAccount()
      toast({ title: 'Signed out', variant: 'success' })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    }
  }

  const signed = account?.status === 'signed_in'

  return (
    <Section title="Settings" description="Proxy account and deployment configuration">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Proxy Account (Microsoft Teams)</CardTitle>
            {!loading && account && (
              <Badge variant={signed ? 'sent' : 'inactive'}>{account.status ?? 'unknown'}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <Spinner />
          ) : signed ? (
            <>
              <div className="flex flex-col gap-1 text-sm">
                <span className="text-[var(--text)]">{account.display_name}</span>
                <span className="text-xs text-[var(--text-muted)] font-mono">{account.upn}</span>
                {account.last_sign_in_at && (
                  <span className="text-xs text-[var(--text-subtle)] font-tabular">
                    Last sign-in: {new Date(account.last_sign_in_at).toLocaleString()}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button intent="default" size="sm" onClick={startSignIn} disabled={signing}>
                  <RefreshCw size={12} /> Re-authenticate
                </Button>
                <Button intent="danger" size="sm" onClick={signOut}>
                  <LogOut size={12} /> Sign Out
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-[var(--text-muted)]">
                No proxy account is signed in. Notification sends will fail until you sign in.
              </p>
              <Button intent="primary" size="sm" onClick={startSignIn} disabled={signing}>
                {signing ? <Spinner size={12} /> : <LogIn size={12} />} Sign In
              </Button>
            </>
          )}

          {deviceCode && (
            <div className="flex flex-col gap-2 p-3 bg-[var(--bg-elev-2)] rounded border border-[var(--border)]">
              <p className="text-xs font-medium text-[var(--text)]">Device Code Flow</p>
              <p className="text-xs text-[var(--text-muted)]">
                Open{' '}
                <a
                  href={deviceCode.verification_uri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--accent)] underline"
                >
                  {deviceCode.verification_uri}
                </a>{' '}
                and enter the code:
              </p>
              <code className="text-lg font-mono font-bold text-[var(--accent)] tracking-widest">
                {deviceCode.user_code}
              </code>
              <p className="text-xs text-[var(--text-subtle)]">Polling for completion...</p>
            </div>
          )}
        </CardContent>
      </Card>
    </Section>
  )
}
