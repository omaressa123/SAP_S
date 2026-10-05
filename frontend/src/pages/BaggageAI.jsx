import { useState } from 'react'
import Card from '../components/Card'
import ScanLine from '../components/animations/ScanLine'
import { AiApi } from '../services/api'

export default function BaggageAI() {
  const [form, setForm] = useState({ bag_id: '', item_type: '', confidence: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setError(''); setResult(null); setBusy(true)
    try {
      const dets = form.item_type ? [{ item_type: form.item_type, confidence: Number(form.confidence || 90) }] : []
      setResult(await AiApi.baggageAnalyze({ bag_id: Number(form.bag_id), detections: dets }))
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }

  return (
    <>
      <h1>Smart Baggage Inspection</h1>
      <Card title="Passenger workflow">
        <ol>
          <li>Step 1 — Place your baggage on the conveyor.</li>
          <li>Step 2 — The baggage enters the X-Ray inspection area.</li>
          <li>Step 3 — AI automatically inspects the baggage.</li>
          <li>Step 4 — Wait for the inspection result.</li>
        </ol>
        <p>Passenger → Baggage → Conveyor → X-Ray Scanner → AI Detection → Clear / Requires inspection</p>
      </Card>
      <Card title="Log AI inspection result">
        <form onSubmit={submit} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
          <label>Bag ID <input required value={form.bag_id} onChange={(e) => setForm({ ...form, bag_id: e.target.value })} /></label>
          <label>Detected item (from BTD model; empty = clear) <input value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })} placeholder="knife / gun / liquid / …" /></label>
          <label>Confidence (0–100) <input value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} placeholder="91.2" /></label>
          <button className="btn" disabled={busy}>{busy ? 'Analyzing…' : 'Submit inspection'}</button>
        </form>
        {busy && <div style={{ marginTop: 12 }}><ScanLine label="ANALYZING X-RAY…" /></div>}
      </Card>
      {error && <Card title="Error"><p className="error">{error}</p></Card>}
      {result && <Card title="Inspection logged"><pre>{JSON.stringify(result, null, 2)}</pre></Card>}
    </>
  )
}
