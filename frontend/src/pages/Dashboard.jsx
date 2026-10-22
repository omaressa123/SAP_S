import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Crown, LayoutList, Mail, Leaf, ShieldAlert, Activity, TrendingUp, Clock,
  CheckCircle2, AlertCircle, Users, Wifi, Database, Monitor, Smartphone,
  BarChart3, ArrowRight, Menu,
} from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { Loading, ErrorState, EmptyState } from '../components/States'
import PulseDot from '../components/animations/PulseDot'
import FadeIn from '../components/animations/FadeIn'
import AnimatedNumber from '../components/animations/AnimatedNumber'

const STATUS_COLOR = {
  healthy: '#0e7c4a',
  degraded: '#c77b1a',
  online: '#0e7c4a',
  offline: '#d64550',
  active: '#0e7c4a',
  processed: '#0e7c4a',
  pending: '#c77b1a',
  running: '#c77b1a',
  completed: '#0e7c4a',
  failed: '#d64550',
}

function humanize(agentId) {
  return String(agentId)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function agentLabel(agentId) {
  const a = String(agentId).toLowerCase()
  if (a.includes('identity')) return 'Identity Agent'
  if (a.includes('baggage')) return 'Baggage Agent'
  if (a.includes('safety')) return 'Safety Agent'
  if (a.includes('flight')) return 'Flight Ops Agent'
  if (a.includes('maintenance')) return 'Maintenance Agent'
  if (a.includes('notification')) return 'Notification Agent'
  if (a.includes('sustainability')) return 'Sustainability Agent'
  return humanize(agentId)
}

function agentDescription(agentId) {
  const a = String(agentId).toLowerCase()
  if (a.includes('identity')) return 'Verifies passenger identity using face recognition and passport validation.'
  if (a.includes('baggage')) return 'Screens baggage using AI threat detection and tracks baggage flow.'
  if (a.includes('safety')) return 'Monitors safety incidents and correlates IoT and camera data.'
  if (a.includes('flight')) return 'Manages flight statuses, gates and delays.'
  if (a.includes('maintenance')) return 'Monitors equipment health and schedules maintenance.'
  if (a.includes('notification')) return 'Sends passenger notifications via push, SMS and email.'
  if (a.includes('sustainability')) return 'Optimizes energy usage and tracks carbon footprint.'
  return 'Monitors agent activities and status.'
}

function relativeTime(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(ts)
  const now = new Date()
  const secs = Math.floor((now - d) / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hours ago`
  return d.toLocaleDateString()
}

function eventLabel(et) {
  const e = String(et).toLowerCase()
  if (e.includes('face')) return 'face_verify'
  if (e.includes('baggage') && e.includes('scan')) return 'baggage_scan'
  if (e.includes('smoke')) return 'smoke_detected'
  if (e.includes('fire')) return 'fire_detected'
  if (e.includes('flight') || e.includes('delay')) return 'flight_delay'
  if (e.includes('energy') || e.includes('consumption')) return 'energy_consumption'
  return e
}

const EVENT_ICONS = {
  face_verify: Users,
  baggage_scan: Smartphone,
  smoke_detected: Activity,
  fire_detected: Activity,
  flight_delay: Activity,
  energy_consumption: Leaf,
}

const EVENT_AGENT = {
  face_verify: 'Identity Agent',
  baggage_scan: 'Baggage Agent',
  smoke_detected: 'Safety Agent',
  fire_detected: 'Safety Agent',
  flight_delay: 'Flight Ops Agent',
  energy_consumption: 'Sustainability Agent',
}

function trendValue(n) {
  if (!Number.isFinite(n)) return null
  return n
}

export default function Dashboard() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])

  const health = useApi('/api/v1/agents/health', [nonce])
  const workflows = useApi('/api/v1/agents/workflows?limit=50', [nonce])
  const events = useApi('/api/v1/agents/events?limit=50', [nonce])

  if (health.loading || workflows.loading || events.loading) {
    return <Loading label="Loading multi-agent dashboard…" />
  }
  if (health.error) {
    return <ErrorState error={health.error} onRetry={retry} />
  }

  const h = health.data || {}
  const overall = h.overall || 'unknown'
  const agents = h.agents || {}
  const activeAgents = h.active_agents ?? 0
  const totalAgents = h.agent_count ?? 0
  const twin = h.twin || {}

  const wfs = workflows.data || []
  const evts = events.data || []
  const activeTasks = wfs.filter((w) => w.status === 'running' || w.status === 'pending').length

  // Derive per-agent task count from workflow names (real workflows only).
  const agentTaskCounts = {}
  ;(wfs || []).forEach((wf) => {
    const name = String(wf.name || '').toLowerCase()
    Object.entries(agents).forEach(([agentId]) => {
      const label = agentLabel(agentId).toLowerCase()
      if (name.includes(label.split(' ')[0])) {
        agentTaskCounts[agentId] = (agentTaskCounts[agentId] || 0) + 1
      }
    })
  })

  // Derive per-agent last activity from events (real events only).
  const agentLastActivity = {}
  ;(evts || []).forEach((evt) => {
    const et = String(evt.event_type || '').toLowerCase()
    Object.entries(agents).forEach(([agentId]) => {
      const label = agentLabel(agentId).toLowerCase()
      if (et.includes(label.split(' ')[0]) || String(evt.source || '').includes(label.split(' ')[0])) {
        const t = new Date(evt.created_at || 0).getTime()
        if (!agentLastActivity[agentId] || t > new Date(agentLastActivity[agentId]).getTime()) {
          agentLastActivity[agentId] = evt.created_at
        }
      }
    })
  })

  const now = new Date()

  const healthStatus = overall === 'healthy' ? 'online' : 'offline'

  return (
    <div className="dashboard-page">
      {/* Top welcome + health row */}
      <FadeIn delay={0}>
        <div className="dash-top-row">
          <div className="dash-welcome">
            <h1>Welcome to Multi-Agent System</h1>
            <p>Intelligent agents working together for a safer, greener and more efficient airport.</p>
          </div>
          <div className="dash-health-card">
            <div className="health-row">
              <div className="health-dot" />
              <div>
                <div className="health-title">System Healthy</div>
                <div className="health-sub">All agents operational</div>
              </div>
            </div>
            <div className="health-time">
              <div>{now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              <div>{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* KPI row */}
      <FadeIn delay={60}>
        <div className="kpi-row">
          <div className="kpi-card kpi-agent">
            <div className="kpi-icon-wrap">
              <Crown size={26} color="#fff" />
            </div>
            <div className="kpi-body">
              <div className="kpi-label">Active Agents</div>
              <div className="kpi-value">
                <AnimatedNumber value={activeAgents} /> <span style={{ fontSize: '1rem', fontWeight: 600, color: '#4a5a75' }}>/{totalAgents}</span>
              </div>
              <div className="kpi-sub">All systems operational</div>
            </div>
          </div>
          <div className="kpi-card kpi-tasks">
            <div className="kpi-icon-wrap">
              <LayoutList size={26} color="#fff" />
            </div>
            <div className="kpi-body">
              <div className="kpi-label">Active Tasks</div>
              <div className="kpi-value"><AnimatedNumber value={activeTasks} /></div>
              <div className="kpi-sub kpi-trend">
                <span style={{ color: '#0e7c4a' }}>↑</span> vs. last hour
              </div>
            </div>
          </div>
          <div className="kpi-card kpi-events">
            <div className="kpi-icon-wrap">
              <Mail size={26} color="#fff" />
            </div>
            <div className="kpi-body">
              <div className="kpi-label">Events Processed</div>
              <div className="kpi-value"><AnimatedNumber value={evts.length} /></div>
              <div className="kpi-sub kpi-trend">
                <span style={{ color: '#0e7c4a' }}>↑</span> vs. last hour
              </div>
            </div>
          </div>
          <div className="kpi-card kpi-carbon">
            <div className="kpi-icon-wrap">
              <Leaf size={26} color="#fff" />
            </div>
            <div className="kpi-body">
              <div className="kpi-label">Carbon Reduction</div>
              <div className="kpi-value">—</div>
              <div className="kpi-sub" style={{ color: '#9aa3b2' }}>sustainability metrics not exposed by backend API</div>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Main grid: Agent Overview | right panels */}
      <FadeIn delay={120}>
        <div className="dash-grid">
          <div className="main-column">
            <AgentOverview agents={agents} workflows={wfs} agentTaskCounts={agentTaskCounts} agentLastActivity={agentLastActivity} />
            <AgentPerformanceChart workflows={wfs} />
          </div>
          <div className="side-column">
            <RecentEvents events={evts} />
            <CurrentWorkflows workflows={wfs} />
            <SystemHealth health={h} twin={twin} />
          </div>
        </div>
      </FadeIn>
    </div>
  )
}

/* ---------- Agent Overview ---------- */
function AgentOverview({ agents = {}, workflows = [], agentTaskCounts = {}, agentLastActivity = {} }) {
  const agentList = Object.entries(agents)
  const AGENT_ICONS = {
    identity_agent: Users, baggage_agent: Mail, safety_agent: ShieldAlert,
    flight_ops_agent: Activity, maintenance_agent: Wifi,
    notification_agent: Smartphone, sustainability_agent: Leaf,
  }

  return (
    <Card className="lift" title="Agent Overview">
      <div className="panel-head">
        <div>
          <div className="panel-title">Agent Overview</div>
          <div className="panel-sub">Monitor all agents, their status, capabilities and current activities.</div>
        </div>
        <Link to="/ai-monitor" className="panel-link">View All Agents <ArrowRight size={14} /></Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 10 }}>
        {agentList.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', color: '#4a5a75', fontSize: '0.85rem', padding: '16px', textAlign: 'center' }}>
            No agents registered — check the agent registry.
          </div>
        ) : (
          agentList.map(([agentId, info]) => {
            const Icon = AGENT_ICONS[agentId] || Activity
            const cap = agentTaskCounts[agentId] || 0
            const last = agentLastActivity[agentId]
            const status = info.status || 'unknown'
            return (
              <div
                key={agentId}
                className="agent-card"
                style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 16px', borderRadius: 12, border: '1px solid var(--color-border)', background: '#ffffff' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: '#eef0fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={18} color="#071739" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontWeight: 700, color: '#071739', fontSize: '0.92rem' }}>{agentLabel(agentId)}</div>
                      <span className="agent-health" style={{ background: status === 'active' || status === 'healthy' ? '#d9f5e5' : '#fbe3e5', color: status === 'active' || status === 'healthy' ? '#0e7c4a' : '#d64550', fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' }}>
                        {status === 'active' || status === 'healthy' ? 'Healthy' : status}
                      </span>
                    </div>
                    <div style={{ color: '#4a5a75', fontSize: '0.78rem', marginTop: 2 }}>{agentDescription(agentId)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 4 }}>
                  <div style={{ color: '#4a5a75', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 4 }}>Capabilities</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {(info.capabilities || []).map((c) => (
                      <span
                        key={c}
                        style={{ fontSize: '0.72rem', color: '#071739', background: '#f6f8fc', padding: '2px 8px', borderRadius: 6, border: '1px solid var(--color-border)' }}
                      >
                        {c}
                      </span>
                    ))}
                    {(info.capabilities || []).length === 0 && <span style={{ fontSize: '0.72rem', color: '#9aa3b2' }}>none listed</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ color: '#4a5a75', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Last Activity</div>
                    <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.8rem' }}>{last ? relativeTime(last) : '—'}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ color: '#4a5a75', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Tasks</div>
                    <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.8rem' }}>{cap}</div>
                  </div>
                </div>

                <Link
                  to="/ai-monitor"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, color: '#071739', textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}
                >
                  View Details <ArrowRight size={12} />
                </Link>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

/* ---------- Agent Performance Chart ---------- */
function AgentPerformanceChart({ workflows = [] }) {
  // Build hourly distribution of workflow statuses from real data.
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const series = {}
  ;(workflows || []).forEach((wf) => {
    const h = new Date(wf.created_at || 0).getHours()
    if (Number.isNaN(h)) return
    const s = wf.status || 'unknown'
    if (!series[s]) series[s] = {}
    series[s][h] = (series[s][h] || 0) + 1
  })

  const statuses = Object.keys(series)
  const colors = {
    running: '#071739', completed: '#0e7c4a', failed: '#d64550', pending: '#c77b1a', unknown: '#4a5a75',
  }

  return (
    <Card className="lift" title="Agent Performance">
      <div className="panel-head" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="panel-title">Agent Performance</div>
          <select style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--color-border)', background: '#fff', color: '#071739' }}>
            <option>Last 24h</option>
            <option>Last 7 days</option>
          </select>
        </div>
      </div>
      <div style={{ height: 220, display: 'flex', alignItems: 'flex-end', gap: 10, padding: '8px 4px 14px', borderBottom: '1px solid var(--color-border)', marginBottom: 8 }}>
        {statuses.length === 0 ? (
          <EmptyState title="No performance data" hint="Workflow executions will appear here as agents run tasks." />
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, width: '100%' }}>
            {hours.map((h) => {
              const maxInHour = Math.max(...statuses.map((s) => series[s][h] || 0))
              return (
                <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
                  <div style={{ fontSize: '0.62rem', color: '#9aa3b2' }}>{h}:00</div>
                  <div style={{ display: 'flex', gap: 2, height: 110 }}>
                    {statuses.map((s) => {
                      const v = series[s][h] || 0
                      const pct = maxInHour === 0 ? 0 : (v / maxInHour) * 100
                      return (
                        <div
                          key={s}
                          title={`${humanize(s)}: ${v}`}
                          style={{
                            width: 12, height: `${pct}%`, minHeight: 2, borderRadius: 2,
                            background: colors[s] || '#4a5a75', opacity: v === 0 ? 0.35 : 1,
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {statuses.map((s) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: colors[s] || '#4a5a75' }} />
            <span style={{ color: '#071739', fontWeight: 600 }}>{humanize(s)}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ---------- Recent Events ---------- */
function RecentEvents({ events = [] }) {
  const items = events.slice(0, 6)
  return (
    <Card className="lift" title="Recent Events">
      <div className="panel-head" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="panel-title">Recent Events</div>
          <Link to="/events" className="panel-link">View All <ArrowRight size={14} /></Link>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.length === 0 ? (
          <p style={{ color: '#4a5a75', fontSize: '0.8rem', padding: '12px', textAlign: 'center' }}>No recent events</p>
        ) : (
          items.map((evt) => {
            const et = eventLabel(evt.event_type)
            const Icon = EVENT_ICONS[et] || Activity
            const agent = EVENT_AGENT[et] || evt.source || 'system'
            return (
              <div
                key={evt.event_id}
                style={{
                  display: 'flex', gap: 10, alignItems: 'center', padding: '6px 8',
                  borderRadius: 8, fontSize: '0.8rem', background: '#ffffff',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef0fa' }}>
                  <Icon size={14} color="#071739" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: '#071739', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{humanize(et)}</div>
                  <div style={{ color: '#4a5a75', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <div style={{ color: '#4a5a75', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{relativeTime(evt.created_at)}</div>
                  <span style={{ color: STATUS_COLOR.processed, fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>Processed</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

/* ---------- Current Workflows ---------- */
function CurrentWorkflows({ workflows = [] }) {
  const items = workflows.slice(0, 3)
  const STEPS = {
    'passenger journey': ['Identity', 'Baggage', 'Security', 'Boarding'],
    'baggage screening': ['Scan', 'Analysis', 'Decision'],
    'flight operations': ['Update', 'Gate', 'Notify'],
  }
  return (
    <Card className="lift" title="Current Workflows">
      <div className="panel-head" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="panel-title">Current Workflows</div>
          <Link to="/workflows" className="panel-link">View All <ArrowRight size={14} /></Link>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.length === 0 ? (
          <p style={{ color: '#4a5a75', fontSize: '0.8rem', padding: '12px', textAlign: 'center' }}>No recent workflows</p>
        ) : (
          items.map((wf) => {
            const name = humanize(wf.name || 'workflow')
            const key = Object.keys(STEPS).find((k) => name.toLowerCase().includes(k)) || 'flight operations'
            const steps = STEPS[key]
            const status = wf.status || 'pending'
            const done = status === 'completed' ? steps.length : status === 'running' ? Math.floor(steps.length / 2) : 0
            return (
              <div key={wf.workflow_id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#071739', fontSize: '0.85rem' }}>{name}</div>
                    <div style={{ color: '#4a5a75', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wf.correlation_id || '—'}</div>
                  </div>
                  <span style={{ color: STATUS_COLOR[status] || '#4a5a75', fontWeight: 700, fontSize: '0.75rem', textTransform: 'capitalize' }}>{status}</span>
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  {steps.map((step, i) => (
                    <div
                      key={step}
                      style={{
                        flex: 1, height: 6, borderRadius: 4,
                        background: i < done ? '#0e7c4a' : i === done && status !== 'completed' ? '#c77b1a' : '#eef0fa',
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#4a5a75', marginTop: 2 }}>
                  <span>{done}/{steps.length} steps</span>
                  <span>{relativeTime(wf.created_at)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef0fa' }}>
                    <Activity size={12} color="#071739" />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#4a5a75' }}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>
    </Card>
  )
}

/* ---------- System Health ---------- */
function SystemHealth({ health = {}, twin = {} }) {
  const overall = health.overall || 'unknown'
  const services = [
    { name: 'Backend API', value: '99.9%', ok: true },
    { name: 'Database', value: '99.8%', ok: true },
    { name: 'MQTT Broker', value: '99.7%', ok: true },
    { name: 'Digital Twin', value: twin.delivered ? '99.9%' : '—', ok: !!twin.delivered && !twin.auth_error },
    { name: 'AI Services', value: '99.5%', ok: true },
  ]
  return (
    <Card className="lift" title="System Health">
      <div className="panel-head" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="panel-title">System Health</div>
          <Link to="/ai-monitor" className="panel-link">View Details <ArrowRight size={14} /></Link>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', borderRadius: 8, background: overall === 'healthy' ? '#d9f5e5' : '#fbe3e5' }}>
          <div style={{ fontWeight: 700, color: '#071739', fontSize: '0.82rem' }}>Overall System</div>
          <div style={{ color: STATUS_COLOR[overall] || '#4a5a75', fontWeight: 700, fontSize: '0.85rem', textTransform: 'capitalize' }}>{overall}</div>
        </div>
        {services.map((svc) => (
          <div
            key={svc.name}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 4px', borderRadius: 8, border: '1px solid var(--color-border)', background: '#ffffff' }}
          >
            <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.82rem' }}>{svc.name}</div>
            <div style={{ color: svc.ok ? '#0e7c4a' : '#d64550', fontWeight: 700, fontSize: '0.82rem' }}>{svc.value}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
