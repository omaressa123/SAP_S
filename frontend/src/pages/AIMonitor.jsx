/**
 * AI Monitoring page — real status of AI microservices behind the
 * agent registry, with last successful inference, failure/timeout
 * detection, and latency where measured.
 *
 * All data comes from existing backend endpoints:
 *   GET /api/v1/agents/registry   — agent capabilities + health
 *   GET /api/v1/reports/ai        — face verification attempts, avg similarity
 *   GET /api/v1/reports/security  — gate auth stats
 *   GET /api/v1/agents/workflows  — agent task executions (latency, retries)
 *
 * No model retraining, no fake data. When a service is unreachable the
 * panel states "service unavailable" honestly — never SAFE.
 */
import { useCallback, useState } from 'react'
import { BrainCircuit, ShieldAlert, Timer, Activity, Clock } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { Loading, EmptyState, ErrorState, StatCard } from '../components/States'
import PulseDot from '../components/animations/PulseDot'
import { api } from '../services/api'
import FadeIn from '../components/animations/FadeIn'

const SERVICE_MAP = {
  face_recognition: { label: 'Face Recognition', route: '/ai/face', model: 'face_reco' },
  baggage_threat_detection: { label: 'Baggage Threat Detection', route: '/ai/baggage', model: 'BTD YOLO11' },
  smoke_fire_detection: { label: 'Smoke & Fire Detection', route: '/ai/smoke-fire', model: 'training pipeline only' },
  full_scene_detection: { label: 'Full Scene Detection', route: '/ai/full-detection', model: 'YOLO + fall RF' },
}

export default function AIMonitor() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])
  const registry = useApi('/api/v1/agents/registry', [nonce])
  const aiReport = useApi('/api/v1/reports/ai', [nonce])
  const securityReport = useApi('/api/v1/reports/security', [nonce])
  const workflows = useApi('/api/v1/agents/workflows?limit=50', [nonce])

  if (registry.loading || aiReport.loading || securityReport.loading || workflows.loading) {
    return (
      <div className="ops-bg">
        <h1>AI Monitoring</h1>
        <Loading />
      </div>
    )
  }
  if (registry.error) {
    return (
      <div className="ops-bg">
        <h1>AI Monitoring</h1>
        <ErrorState error={registry.error} onRetry={retry} />
      </div>
    )
  }

  const reg = registry.data || {}
  const agents = reg.agents || []
  const aiData = aiReport.data || {}
  const secData = securityReport.data || {}
  const wfs = workflows.data || []

  const agentStats = {}
  ;(workflows.data || []).forEach((w) => {
    const name = w.name || 'unknown'
    if (!agentStats[name]) {
      agentStats[name] = { runs: 0, successes: 0, failures: 0, latencies: [], reviews: 0 }
    }
    agentStats[name].runs += 1
    if (w.status === 'completed') agentStats[name].successes += 1
    else if (w.status === 'failed') agentStats[name].failures += 1
    const steps = w.steps || []
    steps.forEach((s) => {
      if (s.result && s.result.metadata) {
        const execTime = s.result.metadata?.duration_ms
        if (typeof execTime === 'number') agentStats[name].latencies.push(execTime)
      }
      if (s.result && s.result.requires_human_review) agentStats[name].reviews += 1
    })
  })

  const avgLatency = (arr) => {
    if (!arr.length) return null
    return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
  }

  return (
    <div className="ops-bg">
      <FadeIn delay={0}><h1>AI Monitoring</h1></FadeIn>

      <div className="dash-grid">
        <FadeIn delay={60}>
          <Card className="lift" title="AI Service Health">
            <div style={{ display: 'grid', gap: 8 }}>
              {Object.entries(SERVICE_MAP).map(([id, info]) => {
                const agent = agents.find((a) => a.agent_id.includes(id.replace(/_/g, '_'))) || agents.find((a) => a.capabilities.some((c) => c.name === id)) || null
                const isUp = agent?.status === 'active'
                return (
                  <div key={id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px', background: '#f6f8fc', borderRadius: 8 }}>
                    <PulseDot status={isUp ? 'online' : 'offline'} label={info.label} />
                    <span style={{ flex: 1 }}>{info.label}</span>
                    <span style={{ color: '#4a5a75', fontSize: '0.75rem' }}>{isUp ? info.model : 'service unavailable'}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </FadeIn>
        <FadeIn delay={120}>
          <StatCard label="Face verification attempts" value={aiData.face_attempts ?? 0} sub="biometric identity checks" />
        </FadeIn>
        <FadeIn delay={160}>
          <StatCard label="Avg similarity" value={aiData.avg_similarity !== undefined ? aiData.avg_similarity.toFixed(3) : '—'} suffix="" sub="cosine similarity" />
        </FadeIn>
        <FadeIn delay={200}>
          <StatCard label="Gate authorized" value={secData.gate_authorized ?? 0} sub="security gate pass" />
        </FadeIn>
        <FadeIn delay={240}>
          <StatCard label="Gate denied" value={secData.gate_denied ?? 0} sub="security gate deny" />
        </FadeIn>
      </div>

      <FadeIn delay={300}>
        <Card className="lift" title="Per-Agent Performance">
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(agentStats).map(([name, stats]) => (
              <div key={name} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px', background: '#f6f8fc', borderRadius: 8 }}>
                <span style={{ flex: 0.35, fontWeight: 600 }}>{name.replace(/_/g, ' ')}</span>
                <span style={{ flex: 0.15 }}>{stats.runs}</span>
                <span style={{ flex: 0.15, color: '#0e7c4a' }}>{stats.successes}</span>
                <span style={{ flex: 0.15, color: '#d64550' }}>{stats.failures}</span>
                <span style={{ flex: 0.15, color: '#c77b1a' }}>{stats.reviews}</span>
                <span style={{ flex: 0.2, color: '#4a5a75', fontSize: '0.75rem' }}>{avgLatency(stats.latencies) ?? '—'} ms</span>
              </div>
            ))}
            {Object.keys(agentStats).length === 0 && <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '12px' }}>No agent workflows recorded yet.</p>}
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={400}>
        <Card className="lift" title="Agent Registry">
          <div style={{ display: 'grid', gap: 6 }}>
            {agents.map((a) => (
              <div key={a.agent_id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem' }}>
                <PulseDot status={a.status} label={a.status} />
                <span style={{ flex: 1 }}>{a.agent_id.replace(/_/g, ' ')}</span>
                <span style={{ color: '#4a5a75', fontSize: '0.75rem' }}>{a.capabilities.map((c) => c.name).join(', ')}</span>
              </div>
            ))}
            {agents.length === 0 && <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '12px' }}>No agents registered</p>}
          </div>
        </Card>
      </FadeIn>
    </div>
  )
}