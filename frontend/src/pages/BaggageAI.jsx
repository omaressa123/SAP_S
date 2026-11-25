import { useRef, useState } from 'react'
import { Luggage, Upload, ScanEye, TriangleAlert, ShieldCheck, Trash2 } from 'lucide-react'
import Card from '../components/Card'
import { AIProcessingIndicator } from '../components/States'
import { AiModuleLayout, ConfidenceBar, KvGrid, ResultCard, EventTimeline } from '../components/ai/AiVisuals'
import useApi from '../hooks/useApi'
import { AiApi } from '../services/api'

function riskTone(result) {
  if (result === 'SAFE') return 'good'
  if (result === 'MANUAL_REVIEW') return 'bad'
  return 'idle'
}

export default function BaggageAI() {
  const [bagId, setBagId] = useState('')
  const [confThreshold, setConfThreshold] = useState(0.35)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageName, setImageName] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const fileInputRef = useRef(null)

  const history = useApi('/api/v1/reports/baggage', [refreshKey])
  const recent = history.data?.recent_inspections || []
  const detectedItemsHistory = history.data?.detected_items || []

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    setResult(null)
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result)
    }
    reader.readAsDataURL(file)
  }

  function clearImage() {
    setImagePreview(null)
    setImageName('')
    setResult(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function scanXrayImage(e) {
    e.preventDefault()
    if (!imagePreview) {
      setError('Please upload an X-ray baggage image first.')
      return
    }
    setError('')
    setResult(null)
    setBusy(true)
    try {
      const payload = {
        image_base64: imagePreview,
        conf: Number(confThreshold),
        ai_model_version: 'btd-yolo11',
      }
      if (bagId.trim() !== '') {
        payload.bag_id = Number(bagId)
      }
      const out = await AiApi.baggageAnalyze(payload)
      setResult(out)
      if (out?.logged_to_db) {
        setRefreshKey((k) => k + 1)
      }
    } catch (err) {
      setError(String(err.message || err))
    } finally {
      setBusy(false)
    }
  }

  const detections = result?.detections || []
  const tone = riskTone(result?.result)

  return (
    <AiModuleLayout
      icon={<Luggage size={22} />}
      title="Baggage X-Ray Threat Detection (AI/BTD)"
      description="Upload an X-ray baggage scan image to detect prohibited items (knife, gun, scissors, powerbank, lighter, etc.) using the AI/BTD YOLO11 model."
      aiStatus="online"
      systemNote="AI/BTD YOLO11 (localhost:8002) · /api/v1/ai/baggage/analyze"
      stats={[
        { label: 'Model', value: 'AI/BTD', sub: 'YOLO11 (12 threat classes)' },
        { label: 'Threats Found', value: result ? detections.length : '—', sub: result ? result.result : 'awaiting scan' },
        { label: 'Last Status', value: result?.result || '—', sub: busy ? 'scanning X-ray…' : result?.inspection_id ? `inspection #${result.inspection_id}` : 'upload image to scan' },
      ]}
    >
      <div className="ai-grid-2">
        {/* Upload & Controls */}
        <Card title="Upload X-Ray Baggage Image">
          <form onSubmit={scanXrayImage} style={{ display: 'grid', gap: 14 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed #94a3b8',
                borderRadius: 10,
                padding: '24px 16px',
                textAlign: 'center',
                cursor: 'pointer',
                background: '#f8fafc',
              }}
            >
              <Upload size={28} color="#0284c7" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                {imageName ? `Selected: ${imageName}` : 'Click to upload X-ray image (JPEG / PNG)'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4 }}>
                Sent directly to AI/BTD YOLO11 threat detection service
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </div>

            <label style={{ display: 'grid', gap: 4 }}>
              <span>Bag ID (optional — logs inspection to PostgreSQL if provided)</span>
              <input
                type="number"
                value={bagId}
                onChange={(e) => setBagId(e.target.value)}
                placeholder="e.g. 101 (leave blank for standalone scan)"
              />
            </label>

            <label style={{ display: 'grid', gap: 4 }}>
              <span>Confidence Threshold: {Math.round(confThreshold * 100)}%</span>
              <input
                type="range"
                min="0.15"
                max="0.90"
                step="0.05"
                value={confThreshold}
                onChange={(e) => setConfThreshold(Number(e.target.value))}
              />
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" type="submit" disabled={busy || !imagePreview} style={{ flex: 1 }}>
                {busy ? 'Scanning X-Ray…' : 'Detect Threats (AI/BTD)'}
              </button>
              {imagePreview && (
                <button
                  type="button"
                  className="btn"
                  onClick={clearImage}
                  style={{ background: '#e2e8f0', color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Trash2 size={14} /> Clear
                </button>
              )}
            </div>
          </form>

          {busy && <AIProcessingIndicator label="AI/BTD PROCESSING" detail="Running YOLO11 X-ray threat inference…" />}
          {error && <p className="error" style={{ marginTop: 10 }}>{error}</p>}
        </Card>

        {/* X-Ray Preview + Real Bounding Boxes */}
        <Card title="X-Ray Scan & Threat Bounding Boxes">
          {!imagePreview ? (
            <div style={{
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#0f172a',
              color: '#94a3b8',
              borderRadius: 10,
              padding: 20,
              textAlign: 'center',
            }}>
              <ScanEye size={36} style={{ marginBottom: 8, opacity: 0.7 }} />
              <div style={{ fontWeight: 600 }}>No X-ray image uploaded</div>
              <div style={{ fontSize: '0.8rem', marginTop: 4 }}>Upload an X-ray scan on the left to inspect threats.</div>
            </div>
          ) : (
            <div style={{ position: 'relative', width: '100%', borderRadius: 10, overflow: 'hidden', background: '#0f172a' }}>
              <img
                src={imagePreview}
                alt="Uploaded X-ray baggage scan"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
              {detections.map((d, idx) => {
                if (!d.bbox) return null
                return (
                  <div
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${d.bbox.x}%`,
                      top: `${d.bbox.y}%`,
                      width: `${d.bbox.w}%`,
                      height: `${d.bbox.h}%`,
                      border: '2px solid #ef4444',
                      background: 'rgba(239, 68, 68, 0.16)',
                      borderRadius: 4,
                      pointerEvents: 'none',
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        top: -22,
                        left: -2,
                        background: '#ef4444',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 3,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {d.item_type.toUpperCase()} · {d.confidence}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {detections.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {detections.map((d, i) => (
                <ConfidenceBar key={i} value={d.confidence} label={`${d.item_type} threat confidence`} />
              ))}
            </div>
          )}
        </Card>
      </div>

      {result && (
        <ResultCard tone={tone} title={result.result === 'SAFE' ? 'CLEAR — NO THREATS DETECTED' : 'THREAT DETECTED — MANUAL REVIEW REQUIRED'}>
          <KvGrid items={[
            { k: 'Model', v: result.model || 'AI/BTD' },
            { k: 'AI Decision', v: result.result },
            { k: 'Threats Detected', v: detections.length },
            { k: 'Detected Items', v: detections.length ? detections.map((d) => `${d.item_type} (${d.confidence}%)`).join(', ') : 'None — clear' },
            { k: 'Inspection #', v: result.inspection_id ?? 'Standalone scan' },
          ]} />
          {result.result === 'SAFE' ? (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <ShieldCheck size={16} color="#16a34a" /> No prohibited items detected at {Math.round(confThreshold * 100)}% threshold.
            </p>
          ) : (
            <p style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <TriangleAlert size={16} color="#dc2626" /> Flagged for manual security inspection.
            </p>
          )}
        </ResultCard>
      )}

      <Card title="Recent inspection timeline (PostgreSQL: baggageinspection & detecteditem)">
        <EventTimeline
          emptyHint="No inspections logged yet."
          events={recent.slice(0, 8).map((r) => {
            const items = detectedItemsHistory.filter((d) => d.inspection_id === r.inspection_id)
            const itemsStr = items.length ? ` · Items: ${items.map((d) => `${d.item_type} (${d.confidence_score}%)`).join(', ')}` : ''
            return {
              title: `${r.bag_id ? `Bag ${r.bag_id}` : 'Standalone X-Ray'} — ${r.result}`,
              detail: `Inspection #${r.inspection_id} · ${r.ai_model_version || 'btd-yolo11'}${itemsStr}`,
              time: r.scan_time,
              severity: r.result === 'SAFE' ? 'low' : 'high',
              badge: r.result,
              tone: r.result === 'SAFE' ? 'good' : 'bad',
            }
          })}
        />
      </Card>
    </AiModuleLayout>
  )
}
