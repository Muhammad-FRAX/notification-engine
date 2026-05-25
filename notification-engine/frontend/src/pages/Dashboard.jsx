import { useEffect, useState } from 'react'
import { Bell, Hash, Users, GitBranch, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react'
import { Section } from '../components/ui/card'
import { StatusBadge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
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
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/stats')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Section title="Dashboard" description="Overview of notification activity">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="Total Notifications" value={stats?.notifications_total} icon={Bell} loading={loading} />
        <StatCard label="Sent"     value={stats?.notifications_sent}    icon={CheckCircle2} loading={loading} />
        <StatCard label="Failed"   value={stats?.notifications_failed}  icon={AlertCircle} loading={loading} />
        <StatCard label="Retrying" value={stats?.deliveries_retrying}   icon={RotateCcw} loading={loading} />
        <StatCard label="Sources"  value={stats?.sources_active}        icon={Hash} loading={loading} />
        <StatCard label="Groups"   value={stats?.groups_total}          icon={GitBranch} loading={loading} />
        <StatCard label="Users"    value={stats?.recipients_users}      icon={Users} loading={loading} />
      </div>
    </Section>
  )
}
