import { useEffect, useState } from 'react'
import { Users, Plus, Trash2 } from 'lucide-react'
import { Section } from '../../components/ui/card'
import { DataTable } from '../../components/ui/data-table'
import { Button, IconButton } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { FieldRow } from '../../components/ui/label'
import { useToast } from '../../components/ui/toast'
import { api } from '../../lib/api'

const COLUMNS = [
  { key: 'display_name', header: 'Name',        width: 180, sortable: true },
  { key: 'upn',          header: 'UPN',          width: 240, sortable: true,
    cell: r => <span className="font-mono text-xs">{r.upn}</span> },
  { key: 'aad_user_id',  header: 'Entra OID',   width: 220,
    cell: r => r.aad_user_id
      ? <span className="font-mono text-xs text-[var(--text-muted)]">{r.aad_user_id}</span>
      : <span className="text-[var(--text-subtle)] text-xs">Not resolved</span> },
  { key: 'notes',        header: 'Notes',        width: 160,
    cell: r => <span className="text-xs text-[var(--text-muted)]">{r.notes ?? ''}</span> },
]

export default function UsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ display_name: '', upn: '', aad_user_id: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await api.get('/admin/recipients/users')
      setUsers(d.users ?? d)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setSaving(true)
    try {
      await api.post('/admin/recipients/users', form)
      setOpen(false)
      setForm({ display_name: '', upn: '', aad_user_id: '', notes: '' })
      await load()
      toast({ title: 'User added', variant: 'success' })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function remove(id) {
    try {
      await api.delete(`/admin/recipients/users/${id}`)
      await load()
      toast({ title: 'User removed', variant: 'success' })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    }
  }

  return (
    <Section
      title="Users"
      description="Teams users who can receive direct messages"
      actions={
        <Button intent="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus size={13} /> Add User
        </Button>
      }
    >
      <DataTable
        columns={COLUMNS}
        data={users}
        loading={loading}
        emptyIcon={Users}
        emptyTitle="No users"
        emptyDescription="Add users by their UPN to enable direct message delivery"
        rowActions={row => (
          <IconButton intent="danger" size="sm" onClick={() => remove(row.id)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FieldRow label="Display Name">
              <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Jane Smith" />
            </FieldRow>
            <FieldRow label="UPN (User Principal Name)" hint="user@example.com">
              <Input value={form.upn} onChange={e => setForm(f => ({ ...f, upn: e.target.value }))} placeholder="user@domain.com" />
            </FieldRow>
            <FieldRow label="Entra Object ID" hint="Optional — paste from Entra admin portal">
              <Input value={form.aad_user_id} onChange={e => setForm(f => ({ ...f, aad_user_id: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
            </FieldRow>
            <FieldRow label="Notes">
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </FieldRow>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button intent="ghost" size="sm">Cancel</Button></DialogClose>
            <Button intent="primary" size="sm" onClick={create} disabled={!form.display_name || !form.upn || saving}>
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
