import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, RotateCcw } from 'lucide-react'
import { Section, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { StatusBadge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { DataTable } from '../../components/ui/data-table'
import { Spinner } from '../../components/ui/spinner'
import { api } from '../../lib/api'

const DELIVERY_COLS = [
  { key: 'recipient_type', header: 'Type',       width: 80 },
  { key: 'recipient_id',   header: 'Recipient',  width: 200,
    cell: r => <span className="font-mono text-xs">{r.recipient_id}</span> },
  { key: 'status',         header: 'Status',     width: 100,
    cell: r => <StatusBadge status={r.status} /> },
  { key: 'attempts',       header: 'Attempts',   width: 80,
    cell: r => <span className="font-tabular">{r.attempts}</span> },
  { key: 'last_error',     header: 'Last Error', width: 220,
    cell: r => r.last_error
      ? <span className="text-[var(--danger)] text-xs truncate">{r.last_error}</span>
      : null },
  { key: 'sent_at',        header: 'Sent At',    width: 160,
    cell: r => r.sent_at
      ? <span className="font-tabular text-xs text-[var(--text-muted)]">{new Date(r.sent_at).toLocaleString()}</span>
      : null },
]

export default function NotificationDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [notification, setNotification] = useState(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await api.get(`/admin/notifications/${id}`)
      setNotification(data)
    } catch {
      // will show loading state
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  async function retryAll() {
    setRetrying(true)
    try {
      await api.post(`/admin/notifications/${id}/retry`)
      await load()
    } finally {
      setRetrying(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><Spinner /></div>
  if (!notification) return <p className="text-[var(--text-muted)] text-sm">Notification not found.</p>

  const deliveries = notification.deliveries ?? []

  return (
    <Section
      title={`Notification ${id.slice(0, 20)}...`}
      actions={
        <div className="flex items-center gap-2">
          <Button intent="ghost" size="sm" onClick={() => navigate(-1)}>
            <ChevronLeft size={13} /> Back
          </Button>
          <Button intent="default" size="sm" onClick={retryAll} disabled={retrying}>
            {retrying ? <Spinner size={12} /> : <RotateCcw size={12} />} Retry Failed
          </Button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 items-center text-sm">
        <StatusBadge status={notification.status} />
        <span className="text-[var(--text-muted)]">{notification.event_type}</span>
        <span className="text-[var(--text-subtle)] font-tabular text-xs">
          {new Date(notification.received_at).toLocaleString()}
        </span>
        <span className="text-[var(--text-subtle)] text-xs">
          {notification.recipient_count} recipient(s)
        </span>
      </div>

      <Card>
        <CardHeader><CardTitle>Payload</CardTitle></CardHeader>
        <CardContent>
          <pre
            className="text-xs font-mono text-[var(--text-muted)] overflow-x-auto whitespace-pre-wrap"
            style={{ maxHeight: 300 }}
          >
            {JSON.stringify(notification.payload, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Section title="Deliveries">
        <DataTable
          columns={DELIVERY_COLS}
          data={deliveries}
          emptyTitle="No deliveries"
          rowActions={row => row.status === 'failed' && (
            <Button
              intent="ghost"
              size="sm"
              onClick={() => api.post(`/admin/deliveries/${row.id}/retry`).then(load)}
            >
              <RotateCcw size={11} /> Retry
            </Button>
          )}
        />
      </Section>
    </Section>
  )
}
