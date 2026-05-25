import { useState } from 'react'
import { Bell, AlertCircle, Package } from 'lucide-react'
import { Section, Card, CardHeader, CardTitle, CardContent, Divider } from '../components/ui/card'
import { Button, IconButton } from '../components/ui/button'
import { Input, Textarea } from '../components/ui/input'
import { Label, FieldRow } from '../components/ui/label'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '../components/ui/select'
import { Checkbox } from '../components/ui/checkbox'
import { Switch } from '../components/ui/switch'
import { Badge, StatusBadge } from '../components/ui/badge'
import { DataTable } from '../components/ui/data-table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter, DialogClose, DialogTrigger } from '../components/ui/dialog'
import { Tooltip, TooltipTrigger, TooltipContent } from '../components/ui/tooltip'
import { EmptyState } from '../components/ui/empty-state'
import { Skeleton, SkeletonText } from '../components/ui/skeleton'
import { Spinner } from '../components/ui/spinner'
import { useToast } from '../components/ui/toast'

const DEMO_ROWS = [
  { id: 'ntf_01', event_type: 'kpi.degraded',  status: 'sent',     recipient_count: 3, received_at: '2026-05-25T10:00:00Z' },
  { id: 'ntf_02', event_type: 'alarm.critical', status: 'partial',  recipient_count: 5, received_at: '2026-05-25T10:15:00Z' },
  { id: 'ntf_03', event_type: 'kpi.recovered',  status: 'failed',   recipient_count: 2, received_at: '2026-05-25T10:30:00Z' },
  { id: 'ntf_04', event_type: 'deploy.done',    status: 'unrouted', recipient_count: 0, received_at: '2026-05-25T10:45:00Z' },
  { id: 'ntf_05', event_type: 'kpi.degraded',   status: 'retrying', recipient_count: 1, received_at: '2026-05-25T11:00:00Z' },
]

const DEMO_COLS = [
  { key: 'id',             header: 'ID',          width: 100, cell: r => <span className="font-mono text-xs">{r.id}</span> },
  { key: 'event_type',     header: 'Event',       width: 160, sortable: true },
  { key: 'status',         header: 'Status',      width: 110, sortable: true, cell: r => <StatusBadge status={r.status} /> },
  { key: 'recipient_count', header: 'Recipients', width: 100, sortable: true, cell: r => <span className="font-tabular">{r.recipient_count}</span> },
  { key: 'received_at',    header: 'Received',    width: 160, sortable: true,
    cell: r => <span className="font-tabular text-xs text-[var(--text-muted)]">{new Date(r.received_at).toLocaleString()}</span>,
    sortValue: r => r.received_at },
]

function DemoBlock({ title, children }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-center gap-3">
        {children}
      </CardContent>
    </Card>
  )
}

export default function Demo() {
  const { toast } = useToast()
  const [checked, setChecked] = useState(false)
  const [switched, setSwitched] = useState(true)
  const [selectVal, setSelectVal] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <Section title="Component Demo" description="All primitives rendered in the current theme">
      <DemoBlock title="Buttons">
        <Button>Default</Button>
        <Button intent="primary">Primary</Button>
        <Button intent="ghost">Ghost</Button>
        <Button intent="danger">Danger</Button>
        <Divider className="w-full" />
        <Button size="sm">Small</Button>
        <Button size="default">Default</Button>
        <Button size="lg">Large</Button>
        <Divider className="w-full" />
        <Button disabled>Disabled</Button>
        <Button intent="primary" disabled>Disabled Primary</Button>
      </DemoBlock>

      <DemoBlock title="Badges">
        <StatusBadge status="sent" />
        <StatusBadge status="partial" />
        <StatusBadge status="failed" />
        <StatusBadge status="unrouted" />
        <StatusBadge status="retrying" />
        <StatusBadge status="queued" />
        <StatusBadge status="sending" />
        <Badge variant="active">active</Badge>
        <Badge variant="inactive">inactive</Badge>
        <Badge>default</Badge>
      </DemoBlock>

      <DemoBlock title="Form Controls">
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <FieldRow label="Text Input" hint="Enter any value">
            <Input placeholder="Placeholder text..." />
          </FieldRow>
          <FieldRow label="Select">
            <Select value={selectVal} onValueChange={setSelectVal}>
              <SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a">Option A</SelectItem>
                <SelectItem value="b">Option B</SelectItem>
                <SelectItem value="c">Option C</SelectItem>
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Textarea">
            <Textarea placeholder="Multi-line text..." rows={2} />
          </FieldRow>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="demo-cb" checked={checked} onCheckedChange={setChecked} />
              <Label htmlFor="demo-cb">Checkbox {checked ? '(on)' : '(off)'}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="demo-sw" checked={switched} onCheckedChange={setSwitched} />
              <Label htmlFor="demo-sw">Switch {switched ? '(on)' : '(off)'}</Label>
            </div>
          </div>
        </div>
      </DemoBlock>

      <DemoBlock title="Feedback">
        <Spinner />
        <Spinner size={20} />
        <Button size="sm" intent="ghost" onClick={() => toast({ title: 'Default toast' })}>
          Default Toast
        </Button>
        <Button size="sm" intent="ghost" onClick={() => toast({ title: 'Success!', description: 'Operation completed.', variant: 'success' })}>
          Success Toast
        </Button>
        <Button size="sm" intent="ghost" onClick={() => toast({ title: 'Error occurred', description: 'Something went wrong.', variant: 'error' })}>
          Error Toast
        </Button>
        <Button size="sm" intent="ghost" onClick={() => toast({ title: 'Info', description: 'Here is some information.', variant: 'info' })}>
          Info Toast
        </Button>
      </DemoBlock>

      <DemoBlock title="Tooltip">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" intent="ghost">Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>This is a tooltip</TooltipContent>
        </Tooltip>
      </DemoBlock>

      <DemoBlock title="Dialog">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button intent="primary" size="sm">Open Dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Example Dialog</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-[var(--text-muted)]">
                This is a dialog with a header, body, and footer. It uses Radix UI Dialog primitives styled with the design tokens.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button intent="ghost" size="sm">Cancel</Button>
              </DialogClose>
              <Button intent="primary" size="sm" onClick={() => setDialogOpen(false)}>Confirm</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DemoBlock>

      <Card>
        <CardHeader><CardTitle>DataTable</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable columns={DEMO_COLS} data={DEMO_ROWS} pageSize={10} />
        </CardContent>
      </Card>

      <DemoBlock title="Loading States">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-48" />
        <div className="w-full max-w-xs">
          <SkeletonText lines={3} />
        </div>
      </DemoBlock>

      <Card>
        <CardHeader><CardTitle>Empty State</CardTitle></CardHeader>
        <CardContent>
          <EmptyState
            icon={Package}
            title="Nothing here yet"
            description="Empty states use a neutral icon, a short title, and a one-line description."
            action={<Button size="sm" intent="primary">Take Action</Button>}
          />
        </CardContent>
      </Card>
    </Section>
  )
}
