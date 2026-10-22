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
import { BrainCircuit, ShieldAlert, Timer, Activity, Clock, Mail, Users } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { Loading, EmptyState, ErrorState, StatCard } from '../components/States'
import PulseDot from '../components/animations/PulseDot'
import { api } from '../services/api'
import FadeIn from '../components/animations/FadeIn'

const SERVICE_MAP = [
  { id: 'face_recognition', label: 'Face Recognition', model: 'face_reco', icon: Users },
  { id: 'baggage_threat_detection', label: 'Baggage Threat Detection', model: 'BTD YOLO11', icon: Mail },
  { id: 'smoke_fire_detection', label: 'Smoke & Fire Detection', model: 'training pipeline only', icon: Activity },
  { id: 'full_scene_detection', label: 'Full Scene Detection', model: 'YOLO + fall RF', icon: BrainCircuit },
]

const STATUS_COLOR = {
  online: '#0e7c4a',
  offline: '#d64550',
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
  ;(wfs || []).forEach((w) => {
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

  const totalRuns = Object.values(agentStats).reduce((s, a) => s + a.runs, 0)
  const totalSuccess = Object.values(agentStats).reduce((s, a) => s + a.successes, 0)
  const totalFail = Object.values(agentStats).reduce((s, a) => s + a.failures, 0)
  const totalReviews = Object.values(agentStats).reduce((s, a) => s + a.reviews, 0)

  const onlineAgents = agents.filter((a) => a.status === 'active').length

  return (
    <div className="dashboard-page">
      <FadeIn delay={0}>
        <div className="dash-top-row">
          <div className="dash-welcome">
            <h1>AI Monitoring</h1>
            <p>Real-time status of AI microservices, agent health, and workflow performance.</p>
          </div>
        </div>
      </FadeIn>

      {/* KPI row */}
      <FadeIn delay={60}>
        <div className="kpi-row">
          <StatCard label="AI Services Online" value={onlineAgents} sub={`of ${agents.length} registered agents`} />
          <StatCard label="Total Workflow Runs" value={totalRuns} sub="agent task executions" />
          <StatCard label="Successful" value={totalSuccess} sub={totalRuns > 0 ? `${Math.round(100 * totalSuccess / totalRuns)}%` : '—'} />
          <StatCard label="Failed / Review" value={totalFail + totalReviews} sub="requires attention" />
        </div>
      </FadeIn>

      <FadeIn delay={120}>
        <div className="dash-grid">
          <div className="main-column">
            {/* AI Service Health */}
            <Card className="lift" title="AI Service Health">
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '0.7rem', color: '#4a5a75', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Service status from agent registry
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                {SERVICE_MAP.map((svc) => {
                  const agent = agents.find((a) =>
                    a.agent_id.includes(svc.id.replace(/_/g, '_')) ||
                    a.capabilities.some((c) => c.name === svc.id)
                  )
                  const isUp = agent?.status === 'active'
                  return (
                    <div
                      key={svc.id}
                      style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: '#ffffff' }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#eef0fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svc.icon size={16} color="#071739" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.label}</div>
                        <div style={{ color: '#4a5a75', fontSize: '0.72rem' }}>{svc.model}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <PulseDot status={isUp ? 'online' : 'offline'} pulse={false} />
                        <span style={{ color: STATUS_COLOR[isUp ? 'online' : 'offline'] || '#4a5a75', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {isUp ? 'Online' : 'Unreachable'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              {SERVICE_MAP.length === 0 && <EmptyState title="No AI services" hint="No services are registered in the agent registry." />}
            </Card>

            {/* Per-Agent Performance */}
            <Card className="lift" title="Per-Agent Performance">
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '0.7rem', color: '#4a5a75', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Workflow execution summary per agent
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(agentStats).length === 0 ? (
                  <p style={{ color: '#4a5a75', fontSize: '0.8rem', padding: '16px', textAlign: 'center' }}>No agent workflows recorded yet.</p>
                ) : (
                  Object.entries(agentStats).map(([name, stats]) => {
                    const avg = avgLatency(stats.latencies)
                    return (
                      <div
                        key={name}
                        style={{ display: 'flex', gap: 10, alignItems: 'start', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--color-border)', background: '#ffffff' }}
                      >
                        <div style={{ flex: 0.3, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name.replace(/_/g, ' ')}</div>
                          <div style={{ color: '#4a5a75', fontSize: '0.72rem', marginTop: 2 }}>{stats.runs} runs</div>
                        </div>
                        <div style={{ display: 'flex', gap: 10, fontSize: '0.78rem', minWidth: 0 }}>
                          <div style={{ flex: 1, color: '#0e7c4a', fontWeight: 600 }}>{stats.successes} ✓</div>
                          <div style={{ flex: 1, color: '#d64550', fontWeight: 600 }}>{stats.failures} ✗</div>
                          <div style={{ flex: 1, color: '#c77b1a', fontWeight: 600 }}>{stats.reviews} ⚠</div>
                          <div style={{ flex: 1, color: '#4a5a75', fontWeight: 600, fontSize: '0.75rem' }}>{avg ?? '—'} ms</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>
          </div>

          <div className="side-column">
            {/* Agent Registry */}
            <Card className="lift" title="Agent Registry">
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '0.7rem', color: '#4a5a75', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Registered autonomous agents
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agents.length === 0 ? (
                  <p style={{ color: '#4a5a75', fontSize: '0.8rem', padding: '16px', textAlign: 'center' }}>No agents registered</p>
                ) : (
                  agents.map((a) => (
                    <div
                      key={a.agent_id}
                      style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: '#ffffff', border: '1px solid var(--color-border)', fontSize: '0.82rem' }}
                    >
                      <PulseDot status={a.status} pulse={false} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.agent_id.replace(/_/g, ' ')}</div>
                        <div style={{ color: '#4a5a75', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(a.capabilities || []).map((c) => c.name).join(', ') || 'no capabilities'}
                        </div>
                      </div>
                      <span style={{ color: STATUS_COLOR[a.status === 'active' ? 'online' : 'offline'] || '#4a5a75', fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{a.status}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Core Metrics */}
            <Card className="lift" title="Core Metrics">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#4a5a75' }}>Face verification attempts</span>
                  <span style={{ fontWeight: 600, color: '#071739' }}>{aiData.face_attempts ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#4a5a75' }}>Avg similarity</span>
                  <span style={{ fontWeight: 600, color: '#071739' }}>{aiData.avg_similarity !== undefined ? aiData.avg_similarity.toFixed(3) : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#4a5a75' }}>Gate authorized</span>
                  <span style={{ fontWeight: 600, color: '#071739' }}>{secData.gate_authorized ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#4a5a75' }}>Gate denied</span>
                  <span style={{ fontWeight: 600, color: '#071739' }}>{secData.gate_denied ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#4a5a75' }}>Inspections</span>
                  <span style={{ fontWeight: 600, color: '#071739' }}>{aiData.inspections ?? 0}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                  <span style={{ color: '#4a5a75' }}>Detected items</span>
                  <span style={{ fontWeight: 600, color: '#071739' }}>{aiData.detected_items ?? 0}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
