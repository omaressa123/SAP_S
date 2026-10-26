import { Link } from 'react-router-dom'
import { ScanFace, Luggage, Users, Flame, ScanEye } from 'lucide-react'
import Card from '../components/Card'
import FadeIn from '../components/animations/FadeIn'
import PulseDot from '../components/animations/PulseDot'
import useApi from '../hooks/useApi'
import { AI_MODULE_FALLBACK } from '../services/aiRegistry'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { AiModuleLayout, StatusBadge } from '../components/ai/AiVisuals'

const ICONS = { face_recognition: ScanFace, baggage_threat_detection: Luggage, baggage_person_detection: Users, smoke_fire_detection: Flame, full_scene_detection: ScanEye }
const ROUTES = { face_recognition: '/ai/face', baggage_threat_detection: '/ai/baggage', baggage_person_detection: '/ai/baggage-person', smoke_fire_detection: '/ai/smoke-fire', full_scene_detection: '/ai/full-detection' }

function MiniPreview({ id }) {
  if (id === 'face_recognition') return (
    <div className="mini-scene" aria-hidden><div className="mini-face" /><div className="mini-beam" style={{ top: '40%' }} /></div>
  )
  if (id === 'baggage_threat_detection' || id === 'baggage_person_detection') return (
    <div className="mini-scene" aria-hidden><div className="mini-bag">🧳</div><div className="mini-beam" style={{ top: '30%', left: '40%', right: '40%' }} /></div>
  )
  if (id === 'smoke_fire_detection') return (
    <div className="mini-scene" aria-hidden><div className="mini-flame">🔥</div></div>
  )
  if (id === 'full_scene_detection') return (
    <div className="mini-scene" aria-hidden><div className="mini-gate-l" /><div className="mini-gate-r" /></div>
  )
  return (
    <div className="mini-scene" aria-hidden><div className="mini-pp" /><div className="mini-beam" style={{ top: '50%' }} /></div>
  )
}

/** Live per-module snapshot from real report endpoints (never fabricated). */
function useLiveStats() {
  const ai = useApi('/api/v1/reports/ai', [])
  const baggage = useApi('/api/v1/reports/baggage', [])
  const ops = useApi('/api/v1/reports/operations', [])
  const live = !ai.error && !baggage.error && !ops.error && (!!ai.data || !!baggage.data || !!ops.data)
  const latestFace = ai.data?.recent_verifications?.[0]
  const latestBag = baggage.data?.recent_inspections?.[0]
  const fires = (ops.data?.emergencies || []).filter((e) => e.event_type === 'smoke_fire')
  const openAlerts = (ops.data?.alerts || []).filter((a) => a.status === 'open')
  return {
    live,
    face_recognition: latestFace ? {
      result: latestFace.verification_status,
      conf: latestFace.cosine_similarity,
      note: `log #${latestFace.verification_id} · passenger ${latestFace.passenger_id}`,
    } : { result: 'no attempts', conf: ai.data ? null : undefined, note: ai.data ? 'no verifications logged' : 'unreachable' },
    baggage_threat_detection: latestBag ? {
      result: latestBag.result, conf: null,
      note: `bag ${latestBag.bag_id} · inspection #${latestBag.inspection_id}`,
      alerts: (baggage.data?.by_result || []).filter((r) => r.result !== 'SAFE').reduce((a, r) => a + r.count, 0),
    } : { result: 'no inspections', conf: null, note: 'nothing logged yet', alerts: 0 },
    baggage_person_detection: {
      result: `${baggage.data?.total_bags ?? '—'} bags tracked`,
      conf: null, note: `${ai.data?.detected_items ?? '—'} threat items detected all-time`,
    },
    smoke_fire_detection: {
      result: fires.length ? `${fires.filter((f) => f.status !== 'resolved').length} active` : 'no events',
      conf: null, note: `${fires.length} smoke/fire events on record`,
      alerts: fires.filter((f) => f.status !== 'resolved').length,
    },
    full_scene_detection: {
      result: openAlerts.length ? `${openAlerts.length} open` : 'queue clear',
      conf: null, note: `${ops.data?.alerts_total ?? '—'} monitoring alerts total`,
      alerts: openAlerts.length,
    },
  }
}

const CAPTION = {
  face_recognition: 'Passport → face → gate',
  baggage_threat_detection: 'Conveyor → X-ray → verdict',
  baggage_person_detection: 'Persons + bags in frame',
  smoke_fire_detection: 'Zones → risk → dispatch',
  full_scene_detection: 'YOLO boxes + behavior',
}

export default function AiCenter() {
  const { data, error, loading } = useApi('/api/v1/ai/registry', [])
  const stats = useLiveStats()
  if (loading) return <Loading label="Loading AI registry…" />
  if (error) return (<><h1>AI Center</h1><ErrorState error={error} /></>)
  const modules = data?.modules?.length ? data.modules : AI_MODULE_FALLBACK
  if (!modules.length) return (<><h1>AI Center</h1><EmptyState hint="no AI modules registered" /></>)
  const online = !error && !!data
  return (
    <AiModuleLayout
      icon={<ScanEye size={22} />}
      title="AI Center — Airport Command"
      description="Each module below opens a live operations view wired to its real API. Snapshots refresh from reporting endpoints."
      aiStatus={online ? 'online' : 'offline'}
      systemNote={`${modules.length} modules registered`}
      stats={[
        { label: 'Modules', value: modules.length, sub: 'all routes live' },
        { label: 'Registry', value: data ? 'LIVE' : 'FALLBACK', sub: data ? 'backend /ai/registry' : 'static mirror' },
      ]}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {modules.map((m, i) => {
          const Icon = ICONS[m.id] || ScanEye
          const s = stats[m.id] || {}
          const confText = s.conf === undefined ? 'unreachable' : s.conf === null ? 'n/a' : `${(Number(s.conf) * 100).toFixed(1)}%`
          return (
            <FadeIn key={m.id} delay={i * 80}>
              <Card title={m.name}>
                <MiniPreview id={m.id} />
                <p style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon size={18} />{m.description}</p>
                <p><PulseDot status={online ? 'online' : 'offline'} label={online ? 'Model Online' : 'Unreachable'} /></p>
                <p style={{ fontSize: '.85rem' }}>
                  <StatusBadge tone={/verified|SAFE|clear|queue clear/i.test(s.result || '') ? 'good' : /failed|active|open|REVIEW/i.test(s.result || '') ? 'warn' : 'idle'}>
                    {String(s.result || '—').toUpperCase()}
                  </StatusBadge>{' '}
                  {s.alerts ? <StatusBadge tone="bad">{s.alerts} ALERTS</StatusBadge> : null}
                </p>
                <p className="ai-muted" style={{ fontSize: '.82rem' }}>
                  Latest: {s.note || '—'} · Confidence: {confText}
                </p>
                <p style={{ color: '#4a5a75', fontSize: '.85rem' }}>Input: {m.input_type} · Ops: {(m.supported_operations || []).join(', ')}</p>
                <p><StatusBadge tone="live">{CAPTION[m.id] || m.input_type}</StatusBadge></p>
                <p><Link to={ROUTES[m.id] || '/ai/face'}>Open live module →</Link></p>
              </Card>
            </FadeIn>
          )
        })}
      </div>
    </AiModuleLayout>
  )
}
