import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Trash2, Users, Layers } from 'lucide-react'
import { Section } from '../../components/ui/card'
import { DataTable } from '../../components/ui/data-table'
import { Button, IconButton } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '../../components/ui/dialog'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import { FieldRow } from '../../components/ui/label'
import { Spinner } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { api } from '../../lib/api'

const MEMBER_COLS = [
  { key: 'member_type', header: 'Type',   width: 80,
    cell: r => r.member_type === 'user'
      ? <Users size={12} style={{ color: 'var(--accent)' }} />
      : <Layers size={12} style={{ color: 'var(--accent)' }} /> },
  { key: 'display_name', header: 'Name', width: 200, sortable: true,
    cell: r => <span>{r.display_name ?? r.member_id}</span> },
  { key: 'identifier',   header: 'UPN / Channel ID', width: 280,
    cell: r => <span className="font-mono text-xs text-[var(--text-muted)]">{r.identifier ?? ''}</span> },
]

export default function GroupDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [users, setUsers] = useState([])
  const [channels, setChannels] = useState([])
  const [addForm, setAddForm] = useState({ member_type: 'user', member_id: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await api.get(`/admin/groups/${id}`)
      setGroup(d.group ?? d)
      setMembers(d.members ?? [])
    } catch { } finally { setLoading(false) }
  }

  async function loadRecipients() {
    try {
      const [ud, cd] = await Promise.all([
        api.get('/admin/recipients/users'),
        api.get('/admin/recipients/channels'),
      ])
      setUsers(ud.users ?? ud)
      setChannels(cd.channels ?? cd)
    } catch { }
  }

  useEffect(() => { load() }, [id])

  function openAddDialog() {
    loadRecipients()
    setAddForm({ member_type: 'user', member_id: '' })
    setAddOpen(true)
  }

  async function addMember() {
    setSaving(true)
    try {
      await api.post(`/admin/groups/${id}/members`, addForm)
      setAddOpen(false)
      await load()
      toast({ title: 'Member added', variant: 'success' })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function removeMember(row) {
    try {
      await api.delete(`/admin/groups/${id}/members/${row.member_type}/${row.member_id}`)
      await load()
      toast({ title: 'Member removed', variant: 'success' })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><Spinner /></div>
  if (!group) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Group not found.</p>

  const recipientOptions = addForm.member_type === 'user' ? users : channels

  return (
    <Section
      title={group.name}
      description={group.description}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button intent="ghost" size="sm" onClick={() => navigate('/groups')}>
            <ChevronLeft size={13} /> Groups
          </Button>
          <Button intent="primary" size="sm" onClick={openAddDialog}>
            <Plus size={13} /> Add Member
          </Button>
        </div>
      }
    >
      <DataTable
        columns={MEMBER_COLS}
        data={members}
        emptyIcon={Users}
        emptyTitle="No members"
        emptyDescription="Add users or channels to this group to enable routing"
        emptyAction={
          <Button intent="primary" size="sm" onClick={openAddDialog}>
            <Plus size={13} /> Add Member
          </Button>
        }
        rowActions={row => (
          <IconButton intent="danger" size="sm" onClick={() => removeMember(row)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
          <DialogBody style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FieldRow label="Type">
              <Select
                value={addForm.member_type}
                onValueChange={v => setAddForm(f => ({ member_type: v, member_id: '' }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="channel">Channel</SelectItem>
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label={addForm.member_type === 'user' ? 'User' : 'Channel'}>
              <Select
                value={addForm.member_id}
                onValueChange={v => setAddForm(f => ({ ...f, member_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${addForm.member_type}`} />
                </SelectTrigger>
                <SelectContent>
                  {recipientOptions.length === 0 && (
                    <SelectItem value="" disabled>
                      No {addForm.member_type === 'user' ? 'users' : 'channels'} available
                    </SelectItem>
                  )}
                  {recipientOptions.map(r => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.display_name}
                      {addForm.member_type === 'user' && r.upn ? ` (${r.upn})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldRow>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button intent="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button
              intent="primary"
              size="sm"
              onClick={addMember}
              disabled={!addForm.member_id || saving}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
