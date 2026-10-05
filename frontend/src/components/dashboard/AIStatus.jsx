import { Link } from 'react-router-dom'
import Card from '../Card'
import PulseDot from '../animations/PulseDot'

const ROUTES = {
  face_recognition: '/ai/face', baggage_threat_detection: '/ai/baggage',
  baggage_person_detection: '/ai/baggage', smoke_fire_detection: '/ai/smoke-fire',
  full_scene_detection: '/ai/full-detection',
}

/** AI module status. Reachable registry -> Model Online (real fetch state). */
export default function AIStatus({ modules = [], reachable = false }) {
  return (
    <Card className="lift" title="AI Status">
      <div style={{ display: 'grid', gap: 8 }}>
        {modules.map((m, i) => (
          <div key={m.id} className="anim-fade-in" style={{ display: 'flex', gap: 8, alignItems: 'center', '--anim-delay': `${i * 60}ms` }}>
            <PulseDot status={reachable ? 'online' : 'offline'} />
            <Link to={ROUTES[m.id] || '/ai'} style={{ flex: 1 }}>{m.name}</Link>
            <span style={{ color: '#4a5a75', fontSize: '0.85rem' }}>{reachable ? 'Model Online' : 'Unreachable'}</span>
          </div>
        ))}
        {!modules.length && <p>No AI modules registered.</p>}
      </div>
    </Card>
  )
}
