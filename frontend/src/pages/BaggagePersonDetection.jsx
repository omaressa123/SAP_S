import { useMemo, useState } from 'react'
import { Users, ScanEye, TriangleAlert } from 'lucide-react'
import Card from '../components/Card'
import { AIProcessingIndicator } from '../components/States'
import { AiModuleLayout, Pipeline, ConfidenceBar, KvGrid, StatusBadge, ResultCard, EventTimeline } from '../components/ai/AiVisuals'
import { ThreeDBaggageConveyor, ThreatDetectionViewer } from '../components/ai/Reusable'
import useApi from '../hooks/useApi'
import { AiApi } from '../services/api'

const PIPE = ['FRAME ENTERS', 'DETECTOR', 'PERSON + BAG CLASSIFY', 'TRACKING', 'VERDICT']

function riskTone(result) {
  if (result === 'CLEAR') return 'good'
  if (result === 'REVIEW') return 'bad'
  return 'idle'
}

export default function BaggagePersonDetection() {
  const [form, setForm] = useState({ item_type: '', confidence: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState(null)
  const history = useApi('/api/v1/reports/baggage', [])

  async function submit(e) {
    e.preventDefault(); setError(''); setResult(null); setBusy(true)
    try {
      const dets = form.item_type ? [{ item_type: form.item_type, confidence: Number(form.confidence || 90) }] : []
      const out = await AiApi.baggagePerson({ detections: dets })
      setResult({ ...out, item_type: form.item_type || null, confidence: form.confidence === '' ? null : Number(form.confidence) })
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }

  const activePipe = busy ? 2 : result ? PIPE.length : form.item_type ? 1 : 0
  const tone = riskTone(result?.result)

  const recent = history.data?.recent_inspections || []
  const conveyorBags = useMemo(() => {
    const live = recent.slice(0, 4).map((r, i) => ({
      id: r.bag_id ?? r.inspection_id, label: `Frame ${r.bag_id ?? r.inspection_id}`,
      cls: r.result === 'CLEAR' ? 'clear' : 'suspicious',
    }))
    if (live.length) return live
    return [{ id: 'live', label: form.item_type ? `Detecting ${form.item_type}` : 'Awaiting frame', cls: '' }]
  }, [recent, form.item_type])

  const boxes = useMemo(() => {
    const dets = form.item_type ? [{ item_type: form.item_type, confidence: Number(form.confidence || 90) }] : []
    const slots = [
      { left: '12%', top: '30%', width: '26%', height: '40%' },
      { left: '44%', top: '22%', width: '22%', height: '48%' },
      { left: '68%', top: '34%', width: '20%', height: '36%' },
    ]
    return dets.map((d, i) => ({ ...d, ...slots[i % slots.length] }))
  }, [form.item_type, form.confidence])

  const selected = selectedFrame
    ? recent.find((r) => String(r.bag_id ?? r.inspection_id) === String(selectedFrame))
    : null
  const selectedDetections = selected
    ? (history.data?.detected_items || []).filter((d) => d.inspection_id === selected.inspection_id)
    : []

  return (
    <AiModuleLayout
      icon={<Users size={22} />}
      title="Baggage & Person Detection — YOLOv8n COCO"
      description="Persons + bags in frame — detect travelers and their carry-on at checkpoints and gates."
      aiStatus="online"
      systemNote="AI/Baggage_And_Person_Detector · /api/v1/ai/scene/baggage-person"
      stats={[
        { label: 'Detections', value: history.data?.detected_items?.length ?? '…', sub: 'live count' },
        { label: 'Frames scanned', value: history.data?.inspections_total ?? '…', sub: 'logged results' },
        { label: 'Last result', value: result?.result || '—', sub: busy ? 'analyzing…' : result ? `frame #${result.inspection_id}` : 'submit a detection' },
      ]}
    >
      <Pipeline stages={PIPE} activeIndex={activePipe} failedIndex={result?.result === 'REVIEW' ? PIPE.length - 1 : -1} />

      <Card title="Live frame — click a detection for details">
        <ThreeDBaggageConveyor
          bags={conveyorBags.map((b) => ({ ...b, label: `${b.label} · ${b.cls === 'clear' ? 'normal' : b.cls === 'suspicious' ? 'REVIEW' : 'in frame'}` }))}
          selectedId={selectedFrame}
          onSelect={setSelectedFrame}
        />
        {!recent.length && <p className="ai-muted" style={{ marginTop: 8 }}>{history.loading ? 'Loading frames…' : 'No detections yet — log the first one below.'}</p>}
        {selected && (
          <div style={{ marginTop: 10 }}>
            <StatusBadge tone={selected.result === 'CLEAR' ? 'good' : 'bad'}>FRAME {selected.bag_id} · {selected.result}</StatusBadge>
            <KvGrid items={[
              { k: 'Frame ID', v: selected.bag_id },
              { k: 'Inspection #', v: selected.inspection_id },
              { k: 'Status', v: selected.result },
              { k: 'Last checkpoint', v: selected.scan_time || '—' },
              { k: 'AI classification', v: selectedDetections.length ? selectedDetections.map((d) => `${d.item_type} (${d.confidence_score}%)`).join(', ') : 'No threat items' },
              { k: 'Model', v: selected.ai_model_version || 'yolo-v8n-coco' },
            ]} />
          </div>
        )}
      </Card>

      <div className="ai-grid-2">
        <Card title="Detection overlay — persons & bags">
          <ThreatDetectionViewer
            scanning={busy}
            detections={boxes.map((b) => ({ label: b.item_type, confidence: b.confidence, cls: 'threat', left: b.left, top: b.top, width: b.width, height: b.height }))}
          />
          {boxes.map((b, i) => (
            <div key={i}><ConfidenceBar value={b.confidence} label={`${b.item_type} detection probability`} /></div>
          ))}
          <p className="ai-muted"><ScanEye size={14} /> Bounding boxes reflect the detections submitted for this frame — not a stock image.</p>
        </Card>

        <Card title="Log detection result">
          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <label>Detected class <input required value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })} placeholder="person / suitcase / backpack / handbag" /></label>
            <label>Confidence (0–100) <input value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value })} placeholder="88.4" /></label>
            <button className="btn" disabled={busy}>{busy ? 'Analyzing…' : 'Submit detection'}</button>
          </form>
          {busy && <AIProcessingIndicator label="AI MODEL PROCESSING" detail="Running person + bag detection…" />}
          {error && <p className="error">{error}</p>}
        </Card>
      </div>

      {result && (
        <ResultCard tone={tone} title={result.result === 'CLEAR' ? 'CLEAR — NO THREAT ITEMS' : 'REQUIRES INSPECTION'}>
          <KvGrid items={[
            { k: 'Class', v: form.item_type || '—' },
            { k: 'Inspection #', v: result.inspection_id },
            { k: 'AI result', v: result.result },
            { k: 'Detected item', v: result.item_type ? `${result.item_type} (${result.confidence ?? '—'}%)` : 'None — clear' },
            { k: 'Risk', v: result.result === 'CLEAR' ? 'Low' : 'High — diverted to manual review' },
          ]} />
          {result.result !== 'CLEAR' && <p><TriangleAlert size={14} /> Diverted: frame held at inspection station, staff notified.</p>}
        </ResultCard>
      )}

      <Card title="Recent detection timeline">
        <EventTimeline
          emptyHint="No detections logged yet."
          events={recent.slice(0, 8).map((r) => ({
            title: `Frame ${r.bag_id} — ${r.result}`,
            detail: `Inspection #${r.inspection_id} · ${r.ai_model_version || 'yolo-v8n-coco'}`,
            time: r.scan_time, severity: r.result === 'CLEAR' ? 'low' : 'high',
            badge: r.result, tone: r.result === 'CLEAR' ? 'good' : 'bad',
          }))}
        />
      </Card>
    </AiModuleLayout>
  )
}
