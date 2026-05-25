import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, Users, Layers } from 'lucide-react'
import { Section } from '../../components/ui/card'
import { DataTable } from '../../components/ui/data-table'
import { Button, IconButton } from '../../components/ui/button'
import { Spinner } from '../../components/ui/spinner'
import { api } from '../../lib/api'

const MEMBER_COLS = [
  { key: 'member_type', header: 'Type',   width: 80,
    cell: r => r.member_type === 'user' ? <Users size={12} className="text-[var(--accent)]" /> : <Layers size={12} className="text-[var(--accent)]" /> },
  { key: 'display_name', header: 'Name', width: 200, sortable: true },
  { key: 'identifier',   header: 'UPN / Channel ID', width: 240,
    cell: r => <span className="font-mono text-xs text-[var(--text-muted)]">{r.identifier}</span> },
]

export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const d = await api.get(`/admin/groups/${id}`)
      setGroup(d.group ?? d)
      setMembers(d.members ?? [])
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function removeMember(memberId) {
    try {
      await api.delete(`/admin/groups/${id}/members/${memberId}`)
      await load()
    } catch { }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><Spinner /></div>
  if (!group) return <p className="text-[var(--text-muted)] text-sm">Group not found.</p>

  return (
    <Section
      title={group.name}
      description={group.description}
      actions={
        <Button intent="ghost" size="sm" onClick={() => navigate('/groups')}>
          <ChevronLeft size={13} /> Groups
        </Button>
      }
    >
      <DataTable
        columns={MEMBER_COLS}
        data={members}
        emptyIcon={Users}
        emptyTitle="No members"
        emptyDescription="Add users or channels to this group via the recipients pages"
        rowActions={row => (
          <IconButton intent="danger" size="sm" onClick={() => removeMember(row.id)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />
    </Section>
  )
}
