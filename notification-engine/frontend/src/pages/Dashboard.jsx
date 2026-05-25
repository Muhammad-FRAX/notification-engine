import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Hash, Users, GitBranch, CheckCircle2, AlertCircle, RotateCcw, LogIn } from 'lucide-react'
import { Section, Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { StatusBadge, Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { Button } from '../components/ui/button'
import { api } from '../lib/api'

function StatCard({ label, value, icon: Icon, loading }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: '16px',
        background: 'var(--bg-elev)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
        {Icon && <Icon size={14} style={{ color: 'var(--text-subtle)' }} />}
      </div>
      {loading ? (
        <Skeleton className="h-6 w-16" />
      ) : (
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {value ?? '—'}
        </span>
      )}
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [recent, setRecent] = useState([])
  const [recentLoading, setRecentLoading] = useState(true)
  const [account, setAccount] = useState(null)

  useEffect(() => {
    api.get('/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setStatsLoading(false))

    api.get('/admin/notifications?limit=5')
      .then(d => setRecent(d.notifications ?? d))
      .catch(() => {})
      .finally(() => setRecentLoading(false))

    api.get('/admin/proxy-account')
      .then(setAccount)
      .catch(() => {})
  }, [])

  const signed = account?.status === 'signed_in'

  return (
    <Section title="Dashboard" description="Overview of notification activity">
      {/* Proxy account status */}
      {account !== null && (
        <Card>
          <CardContent style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Proxy account</span>
              {signed ? (
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{account.upn}</span>
              ) : (
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Not signed in</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Badge variant={signed ? 'active' : 'inactive'}>{account.status ?? 'unknown'}</Badge>
              {!signed && (
                <Button intent="primary" size="sm" onClick={() => navigate('/settings')}>
                  <LogIn size={12} /> Sign In
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Total Notifications" value={stats?.notifications_total} icon={Bell}         loading={statsLoading} />
        <StatCard label="Sent"                value={stats?.notifications_sent}  icon={CheckCircle2} loading={statsLoading} />
        <StatCard label="Failed"              value={stats?.notifications_failed} icon={AlertCircle} loading={statsLoading} />
        <StatCard label="Retrying"            value={stats?.deliveries_retrying}  icon={RotateCcw}  loading={statsLoading} />
        <StatCard label="Sources"             value={stats?.sources_active}       icon={Hash}        loading={statsLoading} />
        <StatCard label="Groups"              value={stats?.groups_total}         icon={GitBranch}   loading={statsLoading} />
        <StatCard label="Users"               value={stats?.recipients_users}     icon={Users}       loading={statsLoading} />
      </div>

      {/* Recent notifications */}
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <CardTitle>Recent Notifications</CardTitle>
            <Button intent="ghost" size="sm" onClick={() => navigate('/notifications')}>View All</Button>
          </div>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          {recentLoading ? (
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : recent.length === 0 ? (
            <p style={{ padding: '16px', margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              No notifications yet. Events will appear here as they arrive.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, width: 180 }}>Event Type</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500, width: 100 }}>Status</th>
                  <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>Received</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(n => (
                  <tr
                    key={n.id}
                    onClick={() => navigate(`/notifications/${n.id}`)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-soft)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '' }}
                  >
                    <td style={{ padding: '8px 16px' }}>
                      <code style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text)' }}>{n.event_type}</code>
                    </td>
                    <td style={{ padding: '8px 16px' }}>
                      <StatusBadge status={n.status} />
                    </td>
                    <td style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(n.received_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </Section>
  )
}
