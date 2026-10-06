import { useMemo, useState } from 'react'
import { ScanEye, PersonStanding, TriangleAlert } from 'lucide-react'
import Card from '../components/Card'
import { AIProcessingIndicator } from '../components/States'
import { AiModuleLayout, Pipeline, ConfidenceBar, KvGrid, StatusBadge, ResultCard, EventTimeline } from '../components/ai/AiVisuals'
import useApi from '../hooks/useApi'
import { AiApi } from '../services/api'

const PIPE = ['FRAME CAPTURE', 'YOLO INFERENCE', 'OBJECTS + BOXES', 'BEHAVIOR CLASS', 'ALERT']
const FALL_PIPE = ['PERSON DETECTED', 'MOVEMENT ANALYSIS', 'FALL DETECTED', 'EMERGENCY ALERT']
const PRESETS = ['unattended_bag', 'fall_detected', 'crowd_density', 'intrusion', 'suspicious_behavior']

export default function FullDetection() {
  const [form, setForm] = useState({ behavior_type: 'unattended_bag', severity: 'medium', zone_id: '', camera_id: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ops = useApi('/api/v1/reports/operations', [])

  const isFall = /fall/i.test(form.behavior_type) || /fall/i.test(result?.behavior_type || '')

  async function submit(e) {
    e.preventDefault(); setError(''); setResult(null); setBusy(true)
    try {
      const out = await AiApi.scene({
        behavior_type: form.behavior_type,
        severity: form.severity,
        zone_id: form.zone_id ? Number(form.zone_id) : null,
        camera_id: form.camera_id ? Number(form.camera_id) : null,
      })
      setResult(out)
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }

  const boxes = useMemo(() => {
    if (isFall) return [{ label: 'person · fall', cls: 'threat', left: '34%', top: '24%', width: '32%', height: '52%' }]
    if (/bag/i.test(form.behavior_type)) return [
      { label: 'bag · unattended', cls: 'threat', left: '14%', top: '52%', width: '24%', height: '30%' },
      { label: 'person', cls: '', left: '58%', top: '22%', width: '26%', height: '56%' },
    ]
    if (/crowd/i.test(form.behavior_type)) return [
      { label: 'person', cls: '', left: '10%', top: '30%', width: '18%', height: '48%' },
      { label: 'person', cls: '', left: '34%', top: '26%', width: '18%', height: '52%' },
      { label: 'person', cls: '', left: '58%', top: '30%', width: '18%', height: '48%' },
    ]
    return [{ label: form.behavior_type || 'object', cls: /high|critical/.test(form.severity) ? 'threat' : '', left: '30%', top: '28%', width: '40%', height: '48%' }]
  }, [form.behavior_type, form.severity, isFall])

  const alerts = ops.data?.alerts || []

  return (
    <AiModuleLayout
      icon={<ScanEye size={22} />}
      title="Full Scene Detection — YOLO + Behavior AI"
      description="Objects, people, falls and crowd behavior classified from camera frames. Boxes below mirror the submitted behavior class and severity."
      aiStatus="online"
      systemNote="AI/fulldetection · /api/v1/ai/scene/analyze"
      stats={[
        { label: 'Behavior class', value: form.behavior_type || '—', sub: `severity ${form.severity}` },
        { label: 'Open alerts', value: alerts.filter((a) => a.status === 'open').length, sub: `${alerts.length} total in pipeline` },
        { label: 'Last alert', value: result?.alert_id ? `#${result.alert_id}` : '—', sub: busy ? 'inferring…' : result ? result.behavior_type : 'no inference yet' },
      ]}
    >
      <Pipeline stages={isFall ? FALL_PIPE : PIPE} activeIndex={busy ? 1 : result ? 99 : 0} failedIndex={-1} />

      <div className="ai-grid-2">
        <Card title={isFall ? 'Fall detection — camera frame' : 'Scene frame — objects + bounding boxes'}>
          <div className="cam-stage">
            <div className="cam-grid-bg" />
            <span className="cam-rec">● REC · CAM {form.camera_id || '—'} · ZONE {form.zone_id || '—'}</span>
            {isFall ? (
              <div className={`skeleton-fig${result || /fall/i.test(form.behavior_type) ? ' fallen' : ''}`} aria-label="person skeleton">
                <i style={{ left: '52px', top: '8px', width: '16px', height: '20px', borderRadius: '50%' }} />
                <i style={{ left: '57px', top: '30px', width: '6px', height: '60px' }} />
                <i style={{ left: '30px', top: '36px', width: '34px', height: '6px' }} />
                <i style={{ left: '60px', top: '36px', width: '34px', height: '6px' }} />
                <i style={{ left: '44px', top: '90px', width: '6px', height: '50px' }} />
                <i style={{ left: '66px', top: '90px', width: '6px', height: '50px' }} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', fontSize: '3rem', margin: '10px 0' }}><PersonStanding size={54} color="#E3C39D" /></div>
            )}
            {boxes.map((b, i) => (
              <div key={i} className={`xray-bbox ${b.cls}`} style={{ left: b.left, top: b.top, width: b.width, height: b.height }}>
                <span className="xray-tag">{b.label}</span>
              </div>
            ))}
            <span className="cam-timestamp">{new Date().toLocaleTimeString()} · live session</span>
          </div>
          <div className="pp-state-row" style={{ marginTop: 10 }}>
            <StatusBadge tone={isFall ? 'bad' : /high|critical/.test(form.severity) ? 'warn' : 'good'}>
              {isFall ? (result ? 'FALL DETECTED — EMERGENCY ALERT' : 'PERSON DETECTED — ANALYZING MOVEMENT') : `CLASS: ${(result?.behavior_type || form.behavior_type || '—').toUpperCase()}`}
            </StatusBadge>
            <StatusBadge tone="live">SEVERITY: {form.severity.toUpperCase()}</StatusBadge>
          </div>
          {isFall && <p className="ai-muted"><TriangleAlert size={14} /> Normal → person detected → movement analysis → {result ? 'fall confirmed → emergency alert raised' : 'awaiting inference'}.</p>}
        </Card>

        <Card title="Run inference log">
          <div className="pp-state-row" style={{ marginBottom: 8 }}>
            {PRESETS.map((p) => (
              <button key={p} className="btn" style={p === form.behavior_type ? {} : { opacity: 0.55 }} onClick={() => setForm({ ...form, behavior_type: p })}>{p}</button>
            ))}
          </div>
          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <label>Behavior / class <input value={form.behavior_type} onChange={(e) => setForm({ ...form, behavior_type: e.target.value })} /></label>
            <label>Severity <input value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} /></label>
            <label>Zone ID <input value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })} /></label>
            <label>Camera ID <input value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value })} /></label>
            <button className="btn" disabled={busy}>{busy ? 'Inferring…' : 'Run inference log'}</button>
          </form>
          {busy && <AIProcessingIndicator label="AI MODEL PROCESSING" detail="Running YOLO inference on the frame…" />}
          {error && <p className="error">{error}</p>}
          <ConfidenceBar value={null} label="Model confidence (returned per-model; logged as alert severity)" />
        </Card>
      </div>

      {result && (
        <ResultCard tone={/high|critical/.test(result.severity) ? 'bad' : 'warn'} title={`DETECTION LOGGED #${result.alert_id}`}>
          <KvGrid items={[
            { k: 'Alert ID', v: result.alert_id },
            { k: 'Behavior', v: result.behavior_type },
            { k: 'Severity', v: result.severity },
            { k: 'Zone / camera', v: `${form.zone_id || '—'} / ${form.camera_id || '—'}` },
            { k: 'State', v: isFall ? 'Emergency alert raised' : 'Monitoring alert open' },
          ]} />
        </ResultCard>
      )}

      <Card title="Monitoring alert timeline">
        <EventTimeline
          emptyHint="No monitoring alerts in database."
          events={alerts.slice(0, 10).map((a) => ({
            title: `${a.behavior_type} — ${a.severity}`,
            detail: `Alert #${a.alert_id} · ${a.status}`,
            time: a.timestamp, severity: a.severity, badge: a.severity?.toUpperCase(),
            tone: /high|critical/.test(a.severity) ? 'bad' : /medium/.test(a.severity) ? 'warn' : 'good',
          }))}
        />
      </Card>
    </AiModuleLayout>
  )
}
