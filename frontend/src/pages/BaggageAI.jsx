import { useMemo, useState } from 'react'
import { Luggage, ScanEye, TriangleAlert } from 'lucide-react'
import Card from '../components/Card'
import { AIProcessingIndicator } from '../components/States'
import { AiModuleLayout, Pipeline, ConfidenceBar, KvGrid, StatusBadge, ResultCard, EventTimeline } from '../components/ai/AiVisuals'
import { ThreeDBaggageConveyor, ThreatDetectionViewer } from '../components/ai/Reusable'
import useApi from '../hooks/useApi'
import { AiApi } from '../services/api'

const PIPE = ['BAG ENTERS', 'SCANNER', 'AI CLASSIFICATION', 'TRACKING', 'DESTINATION', 'EXIT']

function riskTone(result) {
  if (result === 'SAFE') return 'good'
  if (result === 'MANUAL_REVIEW') return 'bad'
  return 'idle'
}

export default function BaggageAI() {
  const [form, setForm] = useState({ bag_id: '', item_type: '', confidence: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedBag, setSelectedBag] = useState(null)
  const history = useApi('/api/v1/reports/baggage', [])

  const recent = history.data?.recent_inspections || []
  const detectedItems = history.data?.detected_items || []

  async function submit(e) {
    e.preventDefault(); setError(''); setResult(null); setBusy(true)
    try {
      const dets = form.item_type ? [{ item_type: form.item_type, confidence: Number(form.confidence || 90) }] : []
      const out = await AiApi.baggageAnalyze({ bag_id: Number(form.bag_id), detections: dets })
      setResult({ ...out, item_type: form.item_type || null, confidence: form.confidence === '' ? null : Number(form.confidence) })
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }

  const activePipe = busy ? 2 : result ? PIPE.length : form.bag_id ? 1 : 0
  const tone = riskTone(result?.result)

  const conveyorBags = useMemo(() => {
    const live = recent.slice(0, 4).map((r, i) => ({
      id: r.bag_id ?? r.inspection_id, label: `Bag ${r.bag_id ?? r.inspection_id}`,
      cls: r.result === 'SAFE' ? 'clear' : 'suspicious',
    }))
    if (live.length) return live
    return [
      { id: 'live', label: form.bag_id ? `Bag ${form.bag_id}` : 'Awaiting bag', cls: '' },
    ]
  }, [recent, form.bag_id])

  const boxes = useMemo(() => {
    // Visualize the REAL detections for this inspection (positions are illustrative layout slots).
    const dets = form.item_type ? [{ item_type: form.item_type, confidence: Number(form.confidence || 90) }] : []
    const slots = [
      { left: '12%', top: '30%', width: '26%', height: '40%' },
      { left: '44%', top: '22%', width: '22%', height: '48%' },
      { left: '68%', top: '34%', width: '20%', height: '36%' },
    ]
    return dets.map((d, i) => ({ ...d, ...slots[i % slots.length] }))
  }, [form.item_type, form.confidence])

  const selected = selectedBag
    ? recent.find((r) => String(r.bag_id ?? r.inspection_id) === String(selectedBag))
    : null
  const selectedDetections = selected
    ? detectedItems.filter((d) => d.inspection_id === selected.inspection_id)
    : []

  return (
    <AiModuleLayout
      icon={<Luggage size={22} />}
      title="Smart Baggage Inspection — Conveyor + X-Ray AI"
      description="Bags travel the conveyor, pass the X-ray arch and are classified live. Select any bag for its structured inspection record."
      aiStatus="online"
      systemNote="AI/BTD YOLO11 · /api/v1/ai/baggage/analyze"
      stats={[
        { label: 'Bags in DB', value: history.data?.total_bags ?? '…', sub: 'live count' },
        { label: 'Inspections', value: history.data?.inspections_total ?? '…', sub: 'logged results' },
        { label: 'Last result', value: result?.result || '—', sub: busy ? 'analyzing…' : result ? `inspection #${result.inspection_id}` : 'submit an inspection' },
      ]}
    >
      <Pipeline stages={PIPE} activeIndex={activePipe} failedIndex={result?.result === 'MANUAL_REVIEW' ? PIPE.length - 1 : -1} />

      {/* Conveyor */}
      <Card title="Live conveyor — click a bag for details">
        <ThreeDBaggageConveyor
          bags={conveyorBags.map((b) => ({ ...b, label: `${b.label} · ${b.cls === 'clear' ? 'normal' : b.cls === 'suspicious' ? 'REVIEW' : 'in transit'}` }))}
          selectedId={selectedBag}
          onSelect={setSelectedBag}
        />
        {!recent.length && <p className="ai-muted" style={{ marginTop: 8 }}>{history.loading ? 'Loading bags…' : 'No inspections yet — log the first one below.'}</p>}
        {selected && (
          <div style={{ marginTop: 10 }}>
            <StatusBadge tone={selected.result === 'SAFE' ? 'good' : 'bad'}>BAG {selected.bag_id} · {selected.result}</StatusBadge>
            <KvGrid items={[
              { k: 'Bag ID', v: selected.bag_id },
              { k: 'Inspection #', v: selected.inspection_id },
              { k: 'Current location', v: 'X-ray exit → sorting' },
              { k: 'Status', v: selected.result },
              { k: 'Last checkpoint', v: selected.scan_time || '—' },
              { k: 'AI classification', v: selectedDetections.length ? selectedDetections.map((d) => `${d.item_type} (${d.confidence_score}%)`).join(', ') : 'No threat items' },
              { k: 'Model', v: selected.ai_model_version || '—' },
            ]} />
          </div>
        )}
      </Card>

      <div className="ai-grid-2">
        {/* X-ray */}
        <Card title="X-ray scan + AI detection">
          <ThreatDetectionViewer
            scanning={busy}
            detections={boxes.map((b) => ({ label: b.item_type, confidence: b.confidence, cls: 'threat', left: b.left, top: b.top, width: b.width, height: b.height }))}
          />
          {boxes.map((b, i) => (
            <div key={i}><ConfidenceBar value={b.confidence} label={`${b.item_type} threat probability`} /></div>
          ))}
          <p className="ai-muted"><ScanEye size={14} /> Bounding boxes reflect the detections submitted for this inspection — not a stock image.</p>
        </Card>

        {/* Form preserved */}
        <Card title="Log AI inspection result">
          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <label>Bag ID <input required value={form.bag_id} onChange={(e) => setForm({ ...form, bag_id: e.target.value })} /></label>
            <label>Detected item (from BTD model; empty = clear) <input value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })} placeholder="knife / gun / liquid / …" /></label>
            <label>Confidence (0–100) <input value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} placeholder="91.2" /></label>
            <button className="btn" disabled={busy}>{busy ? 'Analyzing…' : 'Submit inspection'}</button>
          </form>
          {busy && <AIProcessingIndicator label="AI MODEL PROCESSING" detail="Running X-ray threat analysis…" />}
          {error && <p className="error">{error}</p>}
        </Card>
      </div>

      {result && (
        <ResultCard tone={tone} title={result.result === 'SAFE' ? 'CLEAR — BAG SAFE' : 'REQUIRES INSPECTION'}>
          <KvGrid items={[
            { k: 'Bag ID', v: form.bag_id },
            { k: 'Inspection #', v: result.inspection_id },
            { k: 'AI result', v: result.result },
            { k: 'Detected item', v: result.item_type ? `${result.item_type} (${result.confidence ?? '—'}%)` : 'None — clear' },
            { k: 'Risk', v: result.result === 'SAFE' ? 'Low' : 'High — diverted to manual review' },
          ]} />
          {result.result !== 'SAFE' && <p><TriangleAlert size={14} /> Diverted: bag held at inspection station, staff notified.</p>}
        </ResultCard>
      )}

      <Card title="Recent inspection timeline">
        <EventTimeline
          emptyHint="No inspections logged yet."
          events={recent.slice(0, 8).map((r) => ({
            title: `Bag ${r.bag_id} — ${r.result}`,
            detail: `Inspection #${r.inspection_id} · ${r.ai_model_version || 'btd-yolo11'}`,
            time: r.scan_time, severity: r.result === 'SAFE' ? 'low' : 'high',
            badge: r.result, tone: r.result === 'SAFE' ? 'good' : 'bad',
          }))}
        />
      </Card>
    </AiModuleLayout>
  )
}
