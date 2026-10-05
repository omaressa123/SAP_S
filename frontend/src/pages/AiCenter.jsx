import { Link } from 'react-router-dom'
import { ScanFace, Luggage, Users, Flame, ScanEye } from 'lucide-react'
import Card from '../components/Card'
import FadeIn from '../components/animations/FadeIn'
import PulseDot from '../components/animations/PulseDot'
import useApi from '../hooks/useApi'
import { AI_MODULE_FALLBACK } from '../services/aiRegistry'
import { EmptyState, ErrorState, Loading } from '../components/States'

const ICONS = { face_recognition: ScanFace, baggage_threat_detection: Luggage, baggage_person_detection: Users, smoke_fire_detection: Flame, full_scene_detection: ScanEye }
const ROUTES = { face_recognition: '/ai/face', baggage_threat_detection: '/ai/baggage', baggage_person_detection: '/ai/baggage', smoke_fire_detection: '/ai/smoke-fire', full_scene_detection: '/ai/full-detection' }

export default function AiCenter() {
  const { data, error, loading } = useApi('/api/v1/ai/registry', [])
  if (loading) return <Loading label="Loading AI registry…" />
  if (error) return (<><h1>AI Center</h1><ErrorState error={error} /></>)
  const modules = data?.modules?.length ? data.modules : AI_MODULE_FALLBACK
  if (!modules.length) return (<><h1>AI Center</h1><EmptyState hint="no AI modules registered" /></>)
  return (
    <>
      <h1>AI Center</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        {modules.map((m, i) => {
          const Icon = ICONS[m.id] || ScanEye
          const online = !error && !!data
          return (
            <FadeIn key={m.id} delay={i * 80}>
              <Card title={m.name}>
                <p style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon size={20} />{m.description}</p>
                <p><PulseDot status={online ? 'online' : 'offline'} label={online ? 'Model Online' : 'Unreachable'} /></p>
                <p style={{ color: '#4a5a75' }}>Input: {m.input_type} · Ops: {(m.supported_operations || []).join(', ')}</p>
                <p style={{ color: '#4a5a75' }}>Module: {m.local_module}</p>
                <p><Link to={ROUTES[m.id] || '/ai/face'}>Open Module →</Link></p>
              </Card>
            </FadeIn>
          )
        })}
      </div>
    </>
  )
}
