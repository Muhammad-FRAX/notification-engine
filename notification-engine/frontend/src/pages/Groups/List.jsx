import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import { Section } from '../../components/ui/card'
import { DataTable } from '../../components/ui/data-table'
import { Button, IconButton } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/input'
import { FieldRow } from '../../components/ui/label'
import { useToast } from '../../components/ui/toast'
import { api } from '../../lib/api'

const COLUMNS = [
  { key: 'name',        header: 'Name',        width: 180, sortable: true },
  { key: 'description', header: 'Description', width: 300,
    cell: r => <span className="text-xs text-[var(--text-muted)]">{r.description ?? ''}</span> },
  { key: 'created_at',  header: 'Created',     width: 160, sortable: true,
    cell: r => <span className="font-tabular text-xs text-[var(--text-muted)]">{new Date(r.created_at).toLocaleDateString()}</span>,
    sortValue: r => r.created_at },
]

export default function GroupsList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await api.get('/admin/groups')
      setGroups(d.groups ?? d)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setSaving(true)
    try {
      const g = await api.post('/admin/groups', form)
      setOpen(false)
      setForm({ name: '', description: '' })
      await load()
      navigate(`/groups/${g.id}`)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function remove(id, e) {
    e.stopPropagation()
    try {
      await api.delete(`/admin/groups/${id}`)
      await load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    }
  }

  return (
    <Section
      title="Groups"
      description="Named bundles of users and channels"
      actions={
        <Button intent="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus size={13} /> New Group
        </Button>
      }
    >
      <DataTable
        columns={COLUMNS}
        data={groups}
        loading={loading}
        emptyIcon={GitBranch}
        emptyTitle="No groups"
        emptyDescription="Groups combine users and channels into a single routing target"
        onRowClick={row => navigate(`/groups/${row.id}`)}
        rowActions={(row) => (
          <IconButton intent="danger" size="sm" onClick={e => remove(row.id, e)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Group</DialogTitle></DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FieldRow label="Name">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. CTO + Ops" />
            </FieldRow>
            <FieldRow label="Description">
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
            </FieldRow>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button intent="ghost" size="sm">Cancel</Button></DialogClose>
            <Button intent="primary" size="sm" onClick={create} disabled={!form.name || saving}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
