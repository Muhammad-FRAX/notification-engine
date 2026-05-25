import { useEffect, useState } from 'react'
import { Layers, Plus, Trash2 } from 'lucide-react'
import { Section } from '../../components/ui/card'
import { DataTable } from '../../components/ui/data-table'
import { Button, IconButton } from '../../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '../../components/ui/dialog'
import { Input } from '../../components/ui/input'
import { FieldRow } from '../../components/ui/label'
import { useToast } from '../../components/ui/toast'
import { api } from '../../lib/api'

const COLUMNS = [
  { key: 'display_name', header: 'Name',       width: 180, sortable: true },
  { key: 'team_id',      header: 'Team ID',    width: 200,
    cell: r => <span className="font-mono text-xs text-[var(--text-muted)]">{r.team_id}</span> },
  { key: 'channel_id',   header: 'Channel ID', width: 200,
    cell: r => <span className="font-mono text-xs text-[var(--text-muted)]">{r.channel_id}</span> },
  { key: 'notes',        header: 'Notes',      width: 160,
    cell: r => <span className="text-xs text-[var(--text-muted)]">{r.notes ?? ''}</span> },
]

export default function ChannelsPage() {
  const { toast } = useToast()
  const [channels, setChannels] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ display_name: '', team_id: '', channel_id: '', notes: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await api.get('/admin/recipients/channels')
      setChannels(d.channels ?? d)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setSaving(true)
    try {
      await api.post('/admin/recipients/channels', form)
      setOpen(false)
      setForm({ display_name: '', team_id: '', channel_id: '', notes: '' })
      await load()
      toast({ title: 'Channel added', variant: 'success' })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function remove(id) {
    try {
      await api.delete(`/admin/recipients/channels/${id}`)
      await load()
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    }
  }

  return (
    <Section
      title="Channels"
      description="Teams channels that can receive messages"
      actions={
        <Button intent="primary" size="sm" onClick={() => setOpen(true)}>
          <Plus size={13} /> Add Channel
        </Button>
      }
    >
      <DataTable
        columns={COLUMNS}
        data={channels}
        loading={loading}
        emptyIcon={Layers}
        emptyTitle="No channels"
        emptyDescription="Add team channels using their team_id and channel_id from Teams"
        rowActions={row => (
          <IconButton intent="danger" size="sm" onClick={() => remove(row.id)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Channel</DialogTitle></DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <FieldRow label="Display Name">
              <Input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="e.g. Ops / Alerts" />
            </FieldRow>
            <FieldRow label="Team ID" hint="From the Teams URL or admin portal">
              <Input value={form.team_id} onChange={e => setForm(f => ({ ...f, team_id: e.target.value }))} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" className="font-mono text-xs" />
            </FieldRow>
            <FieldRow label="Channel ID">
              <Input value={form.channel_id} onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))} placeholder="19:xxxxxxxxxxxxxxxx@thread.tacv2" className="font-mono text-xs" />
            </FieldRow>
            <FieldRow label="Notes">
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
            </FieldRow>
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild><Button intent="ghost" size="sm">Cancel</Button></DialogClose>
            <Button intent="primary" size="sm" onClick={create} disabled={!form.display_name || !form.team_id || !form.channel_id || saving}>
              Add Channel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
