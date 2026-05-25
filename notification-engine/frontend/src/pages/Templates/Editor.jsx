import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeft, Save, Play } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { Section, Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { FieldRow } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Switch } from '../../components/ui/switch'
import { Spinner } from '../../components/ui/spinner'
import { useToast } from '../../components/ui/toast'
import { api } from '../../lib/api'

export default function TemplateEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(null)
  const [previewPayload, setPreviewPayload] = useState('{}')
  const [form, setForm] = useState({ name: '', body: '', active: true })

  async function load() {
    setLoading(true)
    try {
      const t = await api.get(`/admin/templates/${id}`)
      setTemplate(t)
      setForm({ name: t.name, body: t.body, active: t.active })
    } catch { } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [id])

  async function save() {
    setSaving(true)
    try {
      await api.put(`/admin/templates/${id}`, form)
      toast({ title: 'Saved', variant: 'success' })
      await load()
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'error' })
    } finally { setSaving(false) }
  }

  async function runPreview() {
    try {
      let payload
      try { payload = JSON.parse(previewPayload) } catch {
        toast({ title: 'Invalid JSON payload', variant: 'error' }); return
      }
      const res = await api.post(`/admin/templates/${id}/preview`, payload)
      setPreview(res.rendered)
    } catch (e) {
      toast({ title: 'Preview error', description: e.message, variant: 'error' })
    }
  }

  if (loading) return <div className="flex items-center justify-center h-40"><Spinner /></div>
  if (!template) return <p className="text-[var(--text-muted)] text-sm">Template not found.</p>

  const monacoLang = template.kind === 'adaptive_card' ? 'json' : 'html'

  return (
    <Section
      title={template.name}
      description={`Kind: ${template.kind} · v${template.version}`}
      actions={
        <div className="flex items-center gap-2">
          <Button intent="ghost" size="sm" onClick={() => navigate('/templates')}>
            <ChevronLeft size={13} /> Templates
          </Button>
          <Button intent="primary" size="sm" onClick={save} disabled={saving}>
            {saving ? <Spinner size={12} /> : <Save size={12} />} Save
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-4">
        <FieldRow label="Name" className="flex-1">
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </FieldRow>
        <FieldRow label="Active" className="shrink-0 items-center flex-row gap-2 pt-4">
          <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
        </FieldRow>
      </div>

      <Card>
        <CardHeader><CardTitle>Body</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Editor
            height="360px"
            language={monacoLang}
            value={form.body}
            onChange={v => setForm(f => ({ ...f, body: v ?? '' }))}
            theme="vs-dark"
            options={{
              fontSize: 12,
              fontFamily: '"JetBrains Mono", monospace',
              minimap: { enabled: false },
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              renderLineHighlight: 'none',
              padding: { top: 12, bottom: 12 },
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Preview</CardTitle>
            <Button intent="ghost" size="sm" onClick={runPreview}>
              <Play size={12} /> Run
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <p className="text-xs text-[var(--text-muted)] mb-1">Sample payload (JSON)</p>
            <Editor
              height="80px"
              language="json"
              value={previewPayload}
              onChange={v => setPreviewPayload(v ?? '{}')}
              theme="vs-dark"
              options={{
                fontSize: 12,
                fontFamily: '"JetBrains Mono", monospace',
                minimap: { enabled: false },
                lineNumbers: 'off',
                scrollBeyondLastLine: false,
                padding: { top: 8, bottom: 8 },
              }}
            />
          </div>
          {preview != null && (
            <pre className="text-xs font-mono text-[var(--text-muted)] whitespace-pre-wrap bg-[var(--bg-elev-2)] p-3 rounded border border-[var(--border)] overflow-x-auto">
              {typeof preview === 'object' ? JSON.stringify(preview, null, 2) : preview}
            </pre>
          )}
        </CardContent>
      </Card>
    </Section>
  )
}
