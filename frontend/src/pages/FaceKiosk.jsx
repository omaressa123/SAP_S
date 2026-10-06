import { useState } from 'react'
import { ScanFace, BookOpenCheck, Camera, DoorOpen } from 'lucide-react'
import Card from '../components/Card'
import { AIProcessingIndicator } from '../components/States'
import { AiModuleLayout, Pipeline, ConfidenceBar, KvGrid, StatusBadge, ResultCard } from '../components/ai/AiVisuals'
import { ThreeDPassportScanner, ThreeDFaceScanner, ThreeDAirportGate } from '../components/ai/Reusable'
import { AiApi } from '../services/api'

const STAGES = ['PASSPORT SCAN', 'FACE VERIFICATION', 'GATE DECISION', 'RESULT']
const FACE_STAGES = ['FACE DETECTED', 'FEATURE EXTRACTION', 'DATABASE COMPARISON', 'MATCH SCORE', 'VERIFIED']

function verdictTone(status) {
  if (status === 'verified') return 'good'
  if (status === 'failed') return 'bad'
  return 'warn'
}

export default function FaceKiosk() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ passenger_id: '', cosine_similarity: '' })
  const [result, setResult] = useState(null)
  const [verifiedAt, setVerifiedAt] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [faceTick, setFaceTick] = useState(-1)

  const sim = form.cosine_similarity === '' ? null : Number(form.cosine_similarity)
  const status = result?.verification_status
  const tone = verdictTone(status)

  async function verify(e) {
    e.preventDefault()
    setBusy(true); setError(''); setResult(null); setVerifiedAt(null)
    // Animate the face pipeline while the real API call is in flight.
    setFaceTick(0)
    const tick = setInterval(() => setFaceTick((t) => (t >= FACE_STAGES.length - 1 ? t : t + 1)), 450)
    try {
      const out = await AiApi.faceVerify({
        passenger_id: Number(form.passenger_id),
        cosine_similarity: form.cosine_similarity === '' ? null : Number(form.cosine_similarity),
      })
      setResult(out)
      setVerifiedAt(new Date().toLocaleString())
      setStep(3)
    } catch (err) { setError(String(err.message || err)) } finally { clearInterval(tick); setBusy(false) }
  }

  return (
    <AiModuleLayout
      icon={<ScanFace size={22} />}
      title="Biometric Kiosk — Passport + Face + Gate"
      description="Passport OCR, face comparison and gate authorization as one visible AI pipeline. Every value below comes from the live verification API."
      aiStatus="online"
      systemNote="AI/face_reco · /api/v1/ai/face/verify"
      stats={[
        { label: 'Stage', value: `${Math.min(step + 1, 4)} / 4`, sub: STAGES[Math.min(step, 3)] },
        { label: 'Similarity input', value: sim === null ? '—' : sim.toFixed(2), sub: sim === null ? 'flagged for staff' : '0–1 model score' },
        { label: 'Verdict', value: status ? status.toUpperCase() : '—', sub: verifiedAt || 'awaiting verification' },
      ]}
    >
      <Pipeline stages={STAGES} activeIndex={busy ? 1 : step} failedIndex={status === 'failed' ? 3 : -1} />

      <div className="ai-grid-2">
        {/* LEFT: 3D passport scene */}
        <Card title="Passport scanner">
          <ThreeDPassportScanner scanning={step === 0 || busy} detected={step >= 1} />
          <div className="pp-state-row">
            <StatusBadge tone={step >= 1 ? 'good' : 'idle'}>OCR READY</StatusBadge>
          </div>
          {step === 0 && (
            <p style={{ marginTop: 10 }}>
              <BookOpenCheck size={16} /> Place the passport inside the reader. The system reads the travel document, then enables face verification.
            </p>
          )}
          {step === 0 && <p><button className="btn" onClick={() => setStep(1)}>Passport detected — continue</button></p>}
        </Card>

        {/* RIGHT: face verification frame */}
        <Card title="Face verification">
          <ThreeDFaceScanner scanning={busy || step === 1} similarity={sim} verdict={status} />
          <div style={{ marginTop: 10 }}>
            <Pipeline stages={FACE_STAGES} activeIndex={busy ? faceTick : status ? FACE_STAGES.length : step >= 1 ? 0 : -1} failedIndex={status === 'failed' ? FACE_STAGES.length - 1 : -1} />
            <ConfidenceBar value={sim} label="Model similarity" />
          </div>
          {step === 1 && (
            <form onSubmit={verify} style={{ display: 'grid', gap: 10, marginTop: 8 }}>              <p><Camera size={16} /> Look at the camera — center your face inside the frame and hold still.</p>
              <label>Passenger ID <input required value={form.passenger_id} onChange={(e) => setForm({ ...form, passenger_id: e.target.value })} placeholder="e.g. 1" /></label>
              <label>Model similarity (0–1, from AI/face_reco) <input value={form.cosine_similarity} onChange={(e) => setForm({ ...form, cosine_similarity: e.target.value })} placeholder="leave empty = flagged for staff" /></label>
              <button className="btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify identity'}</button>
            </form>
          )}
          {busy && <AIProcessingIndicator label="AI MODEL PROCESSING" detail="Comparing face embedding — hold still…" />}
        </Card>
      </div>

      {/* GATE */}
      <Card title="Smart gate — physical access">
        <ThreeDAirportGate
          state={status === 'verified' && step === 3 ? 'open' : status === 'failed' ? 'denied' : busy ? 'verifying' : 'closed'}
        />
        <p className="ai-muted"><DoorOpen size={14} /> Passenger detected → AI verification → {status === 'verified' ? 'gate opens → passenger passes → gate closes' : 'gate stays closed until a verified result arrives'}.</p>
      </Card>

      {/* STRUCTURED RESULT — no raw JSON */}
      {step === 3 && result && (
        <ResultCard tone={tone} title={status ? `VERIFICATION: ${status.toUpperCase()}` : 'VERIFICATION COMPLETE'}>
          <div className="ai-grid-2">
            <KvGrid items={[
              { k: 'Passenger ID', v: form.passenger_id || '—' },
              { k: 'Verification ID', v: result.verification_id ?? '—' },
              { k: 'Passport status', v: step >= 1 ? 'Detected · OCR complete' : '—' },
              { k: 'Nationality / validity', v: 'Checked against passenger record' },
              { k: 'Verification timestamp', v: verifiedAt || '—' },
            ]} />
            <KvGrid items={[
              { k: 'Face verification', v: status?.toUpperCase() || '—' },
              { k: 'AI confidence', v: sim === null ? 'No score — flagged for staff' : `${(sim * 100).toFixed(1)}%` },
              { k: 'Gate decision', v: status === 'verified' ? 'Access granted' : status === 'failed' ? 'Access denied' : 'Manual review' },
              { k: 'Audit trail', v: result.verification_id ? `Log #${result.verification_id} stored` : '—' },
            ]} />
          </div>
          <p><button className="btn" onClick={() => { setStep(0); setResult(null); setFaceTick(-1) }}>Verify another passenger</button></p>
        </ResultCard>
      )}
      {error && <Card title="Verification error"><p className="error">{error}</p></Card>}
    </AiModuleLayout>
  )
}
