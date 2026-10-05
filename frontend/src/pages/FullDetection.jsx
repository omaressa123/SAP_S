import { useState } from 'react'
import Card from '../components/Card'
import { AiApi } from '../services/api'

export default function FullDetection() {
  const [form, setForm] = useState({ behavior_type: 'unattended_bag', severity: 'medium', zone_id: '', camera_id: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault(); setError(''); setResult(null)
    try {
      setResult(await AiApi.scene({
        behavior_type: form.behavior_type,
        severity: form.severity,
        zone_id: form.zone_id ? Number(form.zone_id) : null,
        camera_id: form.camera_id ? Number(form.camera_id) : null,
      }))
    } catch (err) { setError(String(err.message || err)) }
  }

  return (
    <>
      <h1>Full Scene Detection (YOLO)</h1>
      <Card title="Input → YOLO inference → Objects → Bounding boxes → Class → Confidence">
        <p>Log a real vision detection into the monitoring pipeline. Bounding-box overlays appear when the underlying model returns them.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 460 }}>
          <label>Behavior / class <input value={form.behavior_type} onChange={(e) => setForm({ ...form, behavior_type: e.target.value })} /></label>
          <label>Severity <input value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} /></label>
          <label>Zone ID <input value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })} /></label>
          <label>Camera ID <input value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value })} /></label>
          <button className="btn">Run inference log</button>
        </form>
      </Card>
      {error && <Card title="Error"><p className="error">{error}</p></Card>}
      {result && <Card title="Detection logged"><pre>{JSON.stringify(result, null, 2)}</pre></Card>}
    </>
  )
}
