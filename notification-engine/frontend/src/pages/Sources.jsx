import { useEffect, useState } from 'react'
import { Hash, Plus, Trash2, Copy } from 'lucide-react'
import { Section } from '../components/ui/card'
import { DataTable } from '../components/ui/data-table'
import { Badge } from '../components/ui/badge'
import { Button, IconButton } from '../components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose } from '../components/ui/dialog'
import { Input } from '../components/ui/input'
import { FieldRow } from '../components/ui/label'
import { useToast } from '../components/ui/toast'
import { api } from '../lib/api'

const COLUMNS = [
  { key: 'name',          header: 'Name',         width: 160, sortable: true },
  { key: 'api_key_prefix', header: 'Key Prefix',  width: 120,
    cell: r => <span className="font-mono text-xs text-[var(--text-muted)]">{r.api_key_prefix}...</span> },
  { key: 'rate_limit_rpm', header: 'Rate Limit',  width: 110,
    cell: r => <span className="font-tabular text-xs">{r.rate_limit_rpm} rpm</span> },
  { key: 'active',        header: 'Status',        width: 80,
    cell: r => <Badge variant={r.active ? 'active' : 'inactive'}>{r.active ? 'active' : 'inactive'}</Badge> },
  { key: 'last_used_at',  header: 'Last Used',     width: 160,
    cell: r => r.last_used_at
      ? <span className="font-tabular text-xs text-[var(--text-muted)]">{new Date(r.last_used_at).toLocaleString()}</span>
      : <span className="text-[var(--text-subtle)] text-xs">Never</span> },
]

export default function Sources() {
  const { toast } = useToast()
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [form, setForm] = useState({ name: '', rate_limit_rpm: 60 })
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const d = await api.get('/admin/sources')
      setSources(d.sources ?? d)
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function create() {
    setSaving(true)
    try {
      const res = await api.post('/admin/sources', form)
      setNewKey(res.api_key)
      await load()
      setForm({ name: '', rate_limit_rpm: 60 })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function remove(id) {
    try {
      await api.delete(`/admin/sources/${id}`)
      await load()
      toast({ title: 'Source deleted', variant: 'success' })
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    }
  }

  return (
    <Section
      title="Sources"
      description="Systems that send notifications to this engine"
      actions={
        <Button intent="primary" size="sm" onClick={() => { setOpen(true); setNewKey(null) }}>
          <Plus size={13} /> New Source
        </Button>
      }
    >
      <DataTable
        columns={COLUMNS}
        data={sources}
        loading={loading}
        emptyIcon={Hash}
        emptyTitle="No sources"
        emptyDescription="Create a source to get an API key for an external system"
        emptyAction={
          <Button intent="primary" size="sm" onClick={() => setOpen(true)}>
            <Plus size={13} /> New Source
          </Button>
        }
        rowActions={row => (
          <IconButton intent="danger" size="sm" onClick={() => remove(row.id)}>
            <Trash2 size={12} />
          </IconButton>
        )}
      />

      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setNewKey(null) } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKey ? 'API Key — Save This Now' : 'New Source'}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            {newKey ? (
              <>
                <p className="text-xs text-[var(--text-muted)]">
                  This key is shown only once. Copy it before closing.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-[var(--bg-elev-2)] px-2 py-1.5 rounded border border-[var(--border)] text-[var(--accent)] break-all">
                    {newKey}
                  </code>
                  <IconButton
                    size="sm"
                    intent="ghost"
                    onClick={() => { navigator.clipboard.writeText(newKey); toast({ title: 'Copied', variant: 'success' }) }}
                  >
                    <Copy size={13} />
                  </IconButton>
                </div>
              </>
            ) : (
              <>
                <FieldRow label="Name">
                  <Input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Zabbix"
                  />
                </FieldRow>
                <FieldRow label="Rate Limit (req/min)" hint="Max requests per minute from this source">
                  <Input
                    type="number"
                    value={form.rate_limit_rpm}
                    onChange={e => setForm(f => ({ ...f, rate_limit_rpm: Number(e.target.value) }))}
                    min={1}
                  />
                </FieldRow>
              </>
            )}
          </DialogBody>
          <DialogFooter>
            <DialogClose asChild>
              <Button intent="ghost" size="sm">Close</Button>
            </DialogClose>
            {!newKey && (
              <Button intent="primary" size="sm" onClick={create} disabled={!form.name || saving}>
                Create
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
