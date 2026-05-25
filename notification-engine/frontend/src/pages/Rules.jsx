import { useEffect, useState } from 'react'
import { GitBranch, Plus, Trash2 } from 'lucide-react'
import { Section } from '../components/ui/card'
import { DataTable } from '../components/ui/data-table'
import { Badge } from '../components/ui/badge'
import { Button, IconButton } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { FieldRow } from '../components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select'
import { useToast } from '../components/ui/toast'
import { api } from '../lib/api'

const COLUMNS = [
  { key: 'source_name',    header: 'Source',        width: 140, sortable: true },
  { key: 'event_pattern',  header: 'Event Pattern', width: 180, sortable: true,
    cell: r => <code className="text-xs font-mono text-[var(--accent)]">{r.event_pattern}</code> },
  { key: 'group_name',     header: 'Group',         width: 160, sortable: true },
  { key: 'template_name',  header: 'Template',      width: 160,
    cell: r => r.template_name ?? <span className="text-[var(--text-subtle)] text-xs">Default</span> },
  { key: 'priority',       header: 'Priority',      width: 80, sortable: true,
    cell: r => <span className="font-tabular">{r.priority}</span> },
  { key: 'active',         header: 'Status',        width: 80,
    cell: r => <Badge variant={r.active ? 'active' : 'inactive'}>{r.active ? 'active' : 'inactive'}</Badge> },
]

export default function Rules() {
  const { toast } = useToast()
  const [rules, setRules] = useState([])
  const [sources, setSources] = useState([])
  const [groups, setGroups] = useState([])
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ source_id: '', event_pattern: '', group_id: '', template_id: '', priority: 100 })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [rd, sd, gd, td] = await Promise.all([
        api.get('/admin/rules'),
        api.get('/admin/sources'),
        api.get('/admin/groups'),
        api.get('/admin/templates'),
      ])
      setRules(rd.rules ?? rd)
      setSources(sd.sources ?? sd)
      setGroups(gd.groups ?? gd)
      setTemplates(td.templates ?? td)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setSaving(true)
    try {
      await api.post('/admin/rules', { ...form, priority: Number(form.priority) })
      setOpen(false)
      setForm({ source_id: '', event_pattern: '', group_id: '', template_id: '', priority: 100 })
      await load()
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function remove(id) {
    try {
      await api.delete(`/admin/rules/${id}`)
      await load()
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    }
  }

  return (
    <Section
      title="Routing Rules"
      description="Map (source, event pattern) to a group and template"
      actions={
        <Button intent="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus size={13} /> New Rule
        </Button>
      }
    >
      <DataTable
        columns={COLUMNS}
        data={rules}
        loading={loading}
        emptyIcon={GitBranch}
        emptyTitle="No routing rules"
        emptyDescription="Rules determine which group receives which event from which source"
        rowActions={row => (
          <IconButton intent="danger" size="sm" onClick={() => remove(row.id)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Routing Rule</DialogTitle></DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FieldRow label="Source">
              <Select value={form.source_id} onValueChange={v => setForm(f => ({ ...f, source_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Event Pattern" hint="Exact match or trailing wildcard, e.g. kpi.* or alarm.critical">
              <Input value={form.event_pattern} onChange={e => setForm(f => ({ ...f, event_pattern: e.target.value }))} placeholder="kpi.*" className="font-mono" />
            </FieldRow>
            <FieldRow label="Group">
              <Select value={form.group_id} onValueChange={v => setForm(f => ({ ...f, group_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select group" /></SelectTrigger>
                <SelectContent>
                  {groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Template" hint="Leave blank to use the default template">
              <Select value={form.template_id} onValueChange={v => setForm(f => ({ ...f, template_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Default</SelectItem>
                  {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldRow>
            <FieldRow label="Priority" hint="Lower number = higher priority">
              <Input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} min={1} />
            </FieldRow>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button intent="ghost" size="sm">Cancel</Button></DialogClose>
            <Button intent="primary" size="sm" onClick={create} disabled={!form.source_id || !form.event_pattern || !form.group_id || saving}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
