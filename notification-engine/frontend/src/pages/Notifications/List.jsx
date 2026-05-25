import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { Section } from '../../components/ui/card'
import { DataTable } from '../../components/ui/data-table'
import { StatusBadge } from '../../components/ui/badge'
import { api } from '../../lib/api'

const COLUMNS = [
  { key: 'id',         header: 'ID',         width: 180, sortable: true,
    cell: r => <span className="font-mono text-xs text-[var(--text-muted)]">{r.id}</span> },
  { key: 'source_id',  header: 'Source',      width: 140, sortable: true },
  { key: 'event_type', header: 'Event Type',  width: 180, sortable: true },
  { key: 'status',     header: 'Status',      width: 100, sortable: true,
    cell: r => <StatusBadge status={r.status} /> },
  { key: 'received_at', header: 'Received',   width: 160, sortable: true,
    cell: r => <span className="font-tabular text-xs text-[var(--text-muted)]">{new Date(r.received_at).toLocaleString()}</span>,
    sortValue: r => r.received_at },
  { key: 'recipient_count', header: 'Recipients', width: 100, sortable: true,
    cell: r => <span className="font-tabular">{r.recipient_count}</span> },
]

export default function NotificationList() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/admin/notifications')
      .then(d => setData(d.notifications ?? d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <Section title="Notifications" description="Audit log of all received events">
      <DataTable
        columns={COLUMNS}
        data={data}
        loading={loading}
        emptyIcon={Bell}
        emptyTitle="No notifications yet"
        emptyDescription="Events will appear here as they arrive via POST /api/notifications"
        onRowClick={row => navigate(`/notifications/${row.id}`)}
        pageSize={25}
      />
    </Section>
  )
}
