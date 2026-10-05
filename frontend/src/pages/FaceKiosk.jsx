import { useState } from 'react'
import { ScanFace, BookOpenCheck, Camera } from 'lucide-react'
import Card from '../components/Card'
import ScanLine from '../components/animations/ScanLine'
import { AiApi } from '../services/api'

const STEPS = ['SCAN PASSPORT', 'FACE VERIFICATION', 'RESULT']

export default function FaceKiosk() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ passenger_id: '', cosine_similarity: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function verify(e) {
    e.preventDefault()
    setBusy(true); setError(''); setResult(null)
    try {
      const payload = {
        passenger_id: Number(form.passenger_id),
        cosine_similarity: form.cosine_similarity === '' ? null : Number(form.cosine_similarity),
      }
      const out = await AiApi.faceVerify(payload)
      setResult(out)
      setStep(2)
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }

  return (
    <>
      <h1><ScanFace size={22} /> Biometric Kiosk — Passport + Face</h1>
      <Card title={`Step ${step + 1} of 3: ${STEPS[step]}`}>
        {step === 0 && (
          <div>
            <p><BookOpenCheck size={18} /> SCAN YOUR PASSPORT — place your passport inside the reader. The system reads your travel document.</p>
            <p><button className="btn" onClick={() => setStep(1)}>Passport detected — continue</button></p>
          </div>
        )}
        {step === 1 && (
          <form onSubmit={verify} style={{ display: 'grid', gap: 10, maxWidth: 420 }}>
            <p><Camera size={18} /> LOOK AT THE CAMERA — center your face inside the frame. Hold still while verification completes.</p>
            <label>Passenger ID <input required value={form.passenger_id} onChange={(e) => setForm({ ...form, passenger_id: e.target.value })} placeholder="e.g. 1" /></label>
            <label>Model similarity (0–1, from AI/face_reco) <input value={form.cosine_similarity} onChange={(e) => setForm({ ...form, cosine_similarity: e.target.value })} placeholder="leave empty = flagged for staff" /></label>
            <button className="btn" disabled={busy}>{busy ? 'Verifying…' : 'Verify identity'}</button>
          </form>
        )}
        {busy && <div style={{ marginTop: 12 }}><ScanLine label="VERIFYING IDENTITY…" /></div>}
        {step === 2 && result && (
          <div>
            <p><strong>Status: {result.verification_status?.toUpperCase()}</strong></p>
            <pre>{JSON.stringify(result, null, 2)}</pre>
            <p><button className="btn" onClick={() => { setStep(0); setResult(null) }}>Verify another passenger</button></p>
          </div>
        )}
      </Card>
      {error && <Card title="Verification error"><p className="error">{error}</p></Card>}
    </>
  )
}
