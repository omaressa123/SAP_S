import { useMemo, useState } from 'react'
import { Flame } from 'lucide-react'
import Card from '../components/Card'
import { AIProcessingIndicator } from '../components/States'
import { AiModuleLayout, Pipeline, StatusBadge, KvGrid, ResultCard, EventTimeline } from '../components/ai/AiVisuals'
import useApi from '../hooks/useApi'
import { AiApi } from '../services/api'

const PIPE = ['SENSOR WATCH', 'SMOKE DETECTION', 'FIRE CONFIRM', 'RISK SCORING', 'ALERT DISPATCH']

export default function SmokeFire() {
  const ops = useApi('/api/v1/reports/operations', [])
  const [form, setForm] = useState({ zone_id: '', camera_id: '', severity: 'high' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault(); setError(''); setResult(null); setBusy(true)
    try {
      const out = await AiApi.smokeFire({
        zone_id: form.zone_id ? Number(form.zone_id) : null,
        camera_id: form.camera_id ? Number(form.camera_id) : null,
        severity: form.severity,
      })
      setResult(out)
    } catch (err) { setError(String(err.message || err)) } finally { setBusy(false) }
  }

  const fires = (ops.data?.emergencies || []).filter((x) => x.event_type === 'smoke_fire')
  const activeCount = (ops.data?.emergencies || []).filter((e) => e.status !== 'resolved').length

  const zones = useMemo(() => {
    const byZone = new Map()
    for (const f of fires) {
      const z = f.zone_id ?? 'unzoned'
      if (!byZone.has(z)) byZone.set(z, { zone: z, count: 0, last: null })
      const r = byZone.get(z)
      r.count += 1
      r.last = f.detected_time || r.last
    }
    const list = [...byZone.values()].slice(0, 6)
    if (form.zone_id && ![...byZone.keys()].includes(Number(form.zone_id)) && ![...byZone.keys()].includes(form.zone_id)) {
      list.push({ zone: form.zone_id, count: 0, last: null, pending: true })
    }
    return list
  }, [fires, form.zone_id])

  const level = activeCount > 3 || /critical/i.test(form.severity) ? 'critical' : activeCount > 0 || /high/i.test(form.severity) ? 'warning' : 'safe'

  return (
    <AiModuleLayout
      icon={<Flame size={22} />}
      title="Smoke & Fire Monitoring — Environmental AI"
      description="Camera and sensor events flow through detection, risk scoring and alert dispatch. Safety-critical events are always surfaced first."
      aiStatus="online"
      systemNote="AI/smoke_fire_detection · event pipeline"
      stats={[
        { label: 'Zone state', value: level.toUpperCase(), sub: `${activeCount} active emergencies` },
        { label: 'Smoke/fire events', value: fires.length, sub: 'in database history' },
        { label: 'Last event', value: result?.event_id ? `#${result.event_id}` : '—', sub: busy ? 'raising…' : result ? 'recorded' : 'no submission yet' },
      ]}
    >
      <Pipeline stages={PIPE} activeIndex={busy ? 2 : result ? PIPE.length : 0} failedIndex={-1} />
      <p><StatusBadge tone={level === 'safe' ? 'good' : level === 'warning' ? 'warn' : 'bad'}>
        {level === 'safe' ? 'SAFE — ALL ZONES NOMINAL' : level === 'warning' ? 'WARNING — ELEVATED RISK' : 'CRITICAL — ACT ON ALERTS NOW'}
      </StatusBadge></p>

      <div className="ai-grid-2">
        <Card title="Airport zones — live risk">
          <div className="zone-grid">
            {zones.length === 0 && <p className="ai-muted">{ops.loading ? 'Loading zones…' : 'No smoke/fire events yet — all zones nominal.'}</p>}
            {zones.map((z) => {
              const state = z.count > 2 ? 'critical' : z.count > 0 ? 'warning' : 'safe'
              return (
                <div key={z.zone} className={`zone-cell-card ${state}`}>
                  <div><strong>Zone {z.zone}</strong></div>
                  <div className="zone-temp">{z.pending ? '—' : z.count}</div>
                  <div className="ai-muted">{z.pending ? 'monitored — no events' : `event${z.count === 1 ? '' : 's'} on record`}</div>
                  <StatusBadge tone={state === 'safe' ? 'good' : state === 'warning' ? 'warn' : 'bad'}>{state === 'safe' ? 'SAFE' : state === 'warning' ? 'WARNING' : 'CRITICAL'}</StatusBadge>
                </div>
              )
            })}
          </div>
          <p className="ai-muted">Zone state is derived from live smoke/fire event counts in the database.</p>
        </Card>

        <Card title="Raise detection event">
          <form onSubmit={submit} style={{ display: 'grid', gap: 10 }}>
            <label>Zone ID <input value={form.zone_id} onChange={(e) => setForm({ ...form, zone_id: e.target.value })} /></label>
            <label>Camera ID <input value={form.camera_id} onChange={(e) => setForm({ ...form, camera_id: e.target.value })} /></label>
            <label>Severity <input value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })} /></label>
            <button className="btn" disabled={busy}>{busy ? 'Raising…' : 'Raise detection event'}</button>
          </form>
          {busy && <AIProcessingIndicator label="AI MODEL PROCESSING" detail="Scoring sensor frame — dispatching if risk is confirmed…" />}
          {error && <p className="error">{error}</p>}
        </Card>
      </div>

      {result && (
        <ResultCard tone={/critical|high/.test(form.severity) ? 'bad' : 'warn'} title={`EVENT RECORDED #${result.event_id}`}>
          <KvGrid items={[
            { k: 'Event ID', v: result.event_id },
            { k: 'Type', v: 'smoke_fire' },
            { k: 'Zone / camera', v: `${form.zone_id || '—'} / ${form.camera_id || '—'}` },
            { k: 'Severity submitted', v: form.severity },
            { k: 'Status', v: 'detected — dispatched to operations' },
          ]} />
        </ResultCard>
      )}

      <Card title="Smoke/fire event history">
        <EventTimeline
          emptyHint="No smoke/fire events in database."
          events={fires.slice(0, 10).map((f) => ({
            title: `Smoke/fire event #${f.event_id} — ${f.status}`,
            detail: f.zone_id ? `Zone ${f.zone_id}` : undefined,
            time: f.detected_time, severity: 'high', badge: f.status?.toUpperCase(), tone: 'bad',
          }))}
        />
      </Card>
    </AiModuleLayout>
  )
}
