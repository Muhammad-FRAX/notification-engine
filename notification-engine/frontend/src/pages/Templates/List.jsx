import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileCode, Plus, Trash2 } from 'lucide-react'
import { Section } from '../../components/ui/card'
import { DataTable } from '../../components/ui/data-table'
import { Badge } from '../../components/ui/badge'
import { Button, IconButton } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { FieldRow } from '../../components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../../components/ui/select'
import { useToast } from '../../components/ui/toast'
import { api } from '../../lib/api'

const COLUMNS = [
  { key: 'name',    header: 'Name',    width: 200, sortable: true },
  { key: 'kind',    header: 'Kind',    width: 120, sortable: true,
    cell: r => <Badge variant="default">{r.kind}</Badge> },
  { key: 'version', header: 'Version', width: 80,
    cell: r => <span className="font-tabular text-xs">v{r.version}</span> },
  { key: 'active',  header: 'Status',  width: 80,
    cell: r => <Badge variant={r.active ? 'active' : 'inactive'}>{r.active ? 'active' : 'inactive'}</Badge> },
  { key: 'updated_at', header: 'Updated', width: 160, sortable: true,
    cell: r => <span className="font-tabular text-xs text-[var(--text-muted)]">{new Date(r.updated_at).toLocaleDateString()}</span>,
    sortValue: r => r.updated_at },
]

export default function TemplatesList() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', kind: 'text_html' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await api.get('/admin/templates')
      setTemplates(d.templates ?? d)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setSaving(true)
    try {
      const t = await api.post('/admin/templates', { ...form, body: '' })
      setOpen(false)
      setForm({ name: '', kind: 'text_html' })
      navigate(`/templates/${t.id}`)
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function remove(id, e) {
    e.stopPropagation()
    try {
      await api.delete(`/admin/templates/${id}`)
      await load()
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'error' })
    }
  }

  return (
    <Section
      title="Templates"
      description="Message templates used by routing rules"
      actions={
        <Button intent="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus size={13} /> New Template
        </Button>
      }
    >
      <DataTable
        columns={COLUMNS}
        data={templates}
        loading={loading}
        emptyIcon={FileCode}
        emptyTitle="No templates"
        emptyDescription="Templates define how notifications are formatted before sending"
        onRowClick={row => navigate(`/templates/${row.id}`)}
        rowActions={row => (
          <IconButton intent="danger" size="sm" onClick={e => remove(row.id, e)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Template</DialogTitle></DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FieldRow label="Name">
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. KPI Alert Card" />
            </FieldRow>
            <FieldRow label="Kind">
              <Select value={form.kind} onValueChange={v => setForm(f => ({ ...f, kind: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_html">text_html</SelectItem>
                  <SelectItem value="image">image</SelectItem>
                  <SelectItem value="adaptive_card">adaptive_card</SelectItem>
                </SelectContent>
              </Select>
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
