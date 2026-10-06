import { useState } from 'react'
import { Cctv } from 'lucide-react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'
import { AiModuleLayout, StatusBadge, KvGrid, ResultCard } from '../components/ai/AiVisuals'

export default function Monitoring() {
  const [form, setForm] = useState({ cameraId: '', zoneId: '', behaviorType: '', severity: '', unattendedDurationSeconds: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const out = await api('/api/v1/monitoring/cctv/detect', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          cameraId: Number(form.cameraId),
          zoneId: Number(form.zoneId),
          unattendedDurationSeconds: Number(form.unattendedDurationSeconds),
          detectedBoundingBox: { x: 0, y: 0, w: 0, h: 0 },
          snapshotBase64: '',
        }),
      })
      setResult(out)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally { setBusy(false) }
  }

  const sev = /critical/i.test(form.severity) ? 'bad' : /high|medium|warning/i.test(form.severity) ? 'warn' : 'idle'

  return (
    <AiModuleLayout
      icon={<Cctv size={22} />}
      title="CCTV Monitoring — Anomaly Intake"
      description="Detections from camera analytics land here as structured alerts with a visual frame, not a JSON dump."
      aiStatus="online"
      systemNote="camera → AI → alert pipeline"
      stats={[
        { label: 'Camera', value: form.cameraId || '—', sub: `zone ${form.zoneId || '—'}` },
        { label: 'Severity', value: form.severity?.toUpperCase() || '—', sub: form.behaviorType || 'no behavior yet' },
        { label: 'Alert', value: result?.monitoringAlertId ? `#${result.monitoringAlertId}` : '—', sub: result ? result.status : 'no submission yet' },
      ]}
    >
      <div className="ai-grid-2">
        <Card title="Camera frame — detection overlay">
          <div className="cam-stage">
            <div className="cam-grid-bg" />
            <span className="cam-rec">● REC · CAM {form.cameraId || '—'} · ZONE {form.zoneId || '—'}</span>
            <div className="xray-bbox" style={{ left: '28%', top: '26%', width: '44%', height: '50%' }}>
              <span className="xray-tag">{form.behaviorType || 'awaiting behavior'} · {form.severity || '—'}</span>
            </div>
            {busy && <div className="xray-scan" />}
            <span className="cam-timestamp">{form.unattendedDurationSeconds ? `unattended ${form.unattendedDurationSeconds}s` : 'live session'}</span>
          </div>
          <div className="pp-state-row" style={{ marginTop: 10 }}>
            <StatusBadge tone={sev === 'idle' ? 'idle' : sev}>
              {form.behaviorType ? `${form.behaviorType.toUpperCase()} · ${form.severity.toUpperCase()}` : 'IDLE — DESCRIBE THE DETECTION'}
            </StatusBadge>
          </div>
        </Card>

        <Card title="Report detection">
          <form onSubmit={submit}>
            {Object.keys(form).map((k) => (
              <input key={k} placeholder={k} value={form[k]} onChange={set(k)} />
            ))}
            <Button>{busy ? 'Submitting…' : 'Submit'}</Button>
          </form>
          {error && <p className="error">{error}</p>}
        </Card>
      </div>

      {result && (
        <ResultCard tone={result.alertLevel === 'high' || result.alertLevel === 'critical' ? 'bad' : 'warn'} title={`ALERT #${result.monitoringAlertId} — ${result.status?.toUpperCase()}`}>
          <KvGrid items={[
            { k: 'Monitoring alert', v: `#${result.monitoringAlertId}` },
            { k: 'Status', v: result.status },
            { k: 'Alert level', v: result.alertLevel },
            { k: 'Emergency event', v: result.triggeredEmergencyEventId ?? 'none — monitoring only' },
            { k: 'Broadcast to AOCC', v: result.broadcastedToAocc ? 'Yes' : 'No' },
          ]} />
        </ResultCard>
      )}
    </AiModuleLayout>
  )
}
