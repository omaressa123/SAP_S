import { useState } from 'react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { AiApi } from '../services/api'
import { EmptyState } from '../components/States'

export default function SmokeFire() {
  const ops = useApi('/api/v1/reports/operations', [])
  const [form, setForm] = useState({ zone_id: '', camera_id: '', severity: 'high' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault(); setError(''); setResult(null)
    try {
      setResult(await AiApi.smokeFire({
        zone_id: form.zone_id ? Number(form.zone_id) : null,
        camera_id: form.camera_id ? Number(form.camera_id) : null,
        severity: form.severity,
      }))
    } catch (err) { setError(String(err.message || err)) }
  }

  const fires = (ops.data?.emergencies || []).filter((x) => x.event_type === 'smoke_fire')
  return (
    <>
      <h1>Smoke &amp; Fire Monitoring</h1>
      <Card title="Camera → AI Model → Alert → Database → Dashboard">
        <p>Supports the model's real input method: detection events from camera analytics. Live streaming is only shown when the underlying model/service supports it.</p>
        <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label>Zone ID <input value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })} /></label>
          <label>Camera ID <input value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value })} /></label>
          <label>Severity <input value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} /></label>
          <button className="btn">Raise detection event</button>
        </form>
      </Card>
      {error && <Card title="Error"><p className="error">{error}</p></Card>}
      {result && <Card title="Event recorded"><pre>{JSON.stringify(result, null, 2)}</pre></Card>}
      <Card title="Smoke/fire event history">
        {!fires.length ? <EmptyState hint="no smoke/fire events in database" /> : <pre>{JSON.stringify(fires, null, 2)}</pre>}
      </Card>
    </>
  )
}
