import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Crown, LayoutList, Mail, Leaf, ShieldAlert, Activity, TrendingUp, Clock,
  CheckCircle2, AlertCircle, Users, Wifi, Database, Monitor, Smartphone,
  BarChart3, ArrowRight, Menu, Plane, Bell, FileText,
} from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { Loading, ErrorState, EmptyState, BarChart, StatCard } from '../components/States'
import PulseDot from '../components/animations/PulseDot'
import FadeIn from '../components/animations/FadeIn'
import AnimatedNumber from '../components/animations/AnimatedNumber'
import KPICard from '../components/dashboard/KPICard'
import AIStatus from '../components/dashboard/AIStatus'
import FlightStrip from '../components/dashboard/FlightStrip'
import IoTStatus from '../components/dashboard/IoTStatus'
import LiveActivity from '../components/dashboard/LiveActivity'

const STATUS_COLOR = {
  healthy: '#0e7c4a', degraded: '#c77b1a', online: '#0e7c4a', offline: '#d64550',
  active: '#0e7c4a', processed: '#0e7c4a', pending: '#c77b1a', running: '#c77b1a',
  completed: '#0e7c4a', failed: '#d64550',
}

const STATUS_DOT = {
  online: '#0e7c4a', warning: '#c77b1a', offline: '#d64550', critical: '#d64550',
  healthy: '#0e7c4a', degraded: '#c77b1a',
}

function humanize(agentId) {
  return String(agentId).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
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

function fmtNum(n) {
  return Number.isFinite(Number(n)) ? Number(n) : 0
}

const AGENT_ICONS = {
  identity_agent: Users, baggage_agent: Mail, safety_agent: ShieldAlert,
  flight_ops_agent: Activity, maintenance_agent: Wifi,
  notification_agent: Smartphone, sustainability_agent: Leaf,
}

export default function Dashboard() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])

  const health = useApi('/api/v1/agents/health', [nonce])
  const workflows = useApi('/api/v1/agents/workflows?limit=50', [nonce])
  const events = useApi('/api/v1/agents/events?limit=50', [nonce])
  const overview = useApi('/api/v1/reports/overview', [nonce])
  const twinLive = useApi('/api/v1/digital-twin/dashboard/live', [nonce])
  const flightsReport = useApi('/api/v1/reports/flights', [nonce])
  const securityReport = useApi('/api/v1/reports/security', [nonce])
  const iotReport = useApi('/api/v1/reports/iot', [nonce])

  if (health.loading || overview.loading || twinLive.loading) {
    return <Loading label="Loading live airport data…" />
  }
  if (health.error || overview.error) {
    return <ErrorState error={health.error || overview.error} onRetry={retry} />
  }

  const h = health.data || {}
  const overall = h.overall || 'unknown'
  const agents = h.agents || {}
  const activeAgents = h.active_agents ?? 0
  const totalAgents = h.agent_count ?? 0

  const wfs = workflows.data || []
  const evts = events.data || []
  const activeTasks = wfs.filter((w) => w.status === 'running' || w.status === 'pending').length

  const ov = overview.data || {}
  const tl = twinLive.data || {}
  const zones = tl.zonesOccupancy || ov.zonesOccupancy || []

  const now = new Date()
  const healthStatus = overall === 'healthy' ? 'online' : 'degraded'

  // Derive per-agent task count / last activity from real data.
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

  return (
    <div className="dashboard-page">
      {/* Top welcome + health */}
      <FadeIn delay={0}>
        <div className="dash-top-row">
          <div className="dash-welcome">
            <h1>Airport Operations</h1>
            <p>Live multi-agent oversight · {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div className="dash-health-card">
            <div className="health-row">
              <div className="health-dot" />
              <div>
                <div className="health-title">System {overall.charAt(0).toUpperCase() + overall.slice(1)}</div>
                <div className="health-sub">
                  {activeAgents}/{totalAgents} agents active · {activeTasks} tasks running
                </div>
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
      <FadeIn delay={40}>
        <div className="kpi-row">
          <KPICard icon={Users} label="Passengers" value={tl.passengerCount ?? ov.passengers ?? 0} sub={tl.passengerCount ? 'live count' : 'registered'} />
          <KPICard icon={Plane} label="Active Flights" value={tl.activeFlightsCount ?? ov.flights ?? 0} sub={tl.activeFlightsCount ? 'live' : 'registered'} />
          <KPICard icon={Mail} label="Bags Processed" value={tl.activeBagsCount ?? ov.bags ?? 0} sub={tl.activeBagsCount ? 'live' : 'registered'} />
          <KPICard icon={Bell} label="Open Alerts" value={tl.openAlertsCount ?? ov.open_alerts ?? 0} sub={ov.active_emergencies ? `${ov.active_emergencies} emergencies` : ''} />
          <KPICard icon={Activity} label="Active Agents" value={activeAgents} suffix={` / ${totalAgents}`} sub="multi-agent system" />
          <KPICard icon={Monitor} label="System Health" value={overall === 'healthy' ? 100 : (overall === 'degraded' ? 70 : 0)} decimals={0} suffix="%" sub={healthStatus} />
        </div>
      </FadeIn>

      {/* Main operational grid */}
      <FadeIn delay={80}>
        <div className="dash-grid">
          <div className="main-column">
            {/* Zones occupancy */}
            <Card className="lift" title="Terminal Zone Occupancy">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Zone Occupancy</div>
                  <div className="panel-sub">Passenger density by terminal zone (live feed).</div>
                </div>
              </div>
              <div style={{ marginTop: 8 }}>
                {zones.length ? (
                  <BarChart title="" rows={zones.map((z) => ({ label: z.zoneName, value: z.currentOccupancy }))} labelKey="label" valueKey="value" />
                ) : (
                  <EmptyState title="Zone Occupancy" hint="Occupancy data not yet exposed by the twin / IoT feed." />
                )}
              </div>
            </Card>

            {/* Active flights */}
            <FlightStrip flights={flightsReport.data ? (flightsReport.data.flights || []).slice(0, 10) : []} />

            {/* Live operations feed */}
            <LiveActivity />
          </div>

          <div className="side-column">
            {/* Agent overview (compact cards) */}
            <Card className="lift" title="Agent Overview">
              <div className="panel-head">
                <div>
                  <div className="panel-title">Agent Overview</div>
                  <div className="panel-sub">Multi-agent status and current activity.</div>
                </div>
                <Link to="/ai-monitor" className="panel-link">View All <ArrowRight size={14} /></Link>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8, marginTop: 6 }}>
                {Object.entries(agents).length === 0 ? (
                  <p style={{ color: '#4a5a75', fontSize: '0.8rem', padding: '10px', textAlign: 'center' }}>No agents registered.</p>
                ) : (
                  Object.entries(agents).map(([agentId, info]) => {
                    const Icon = AGENT_ICONS[agentId] || Activity
                    const cap = agentTaskCounts[agentId] || 0
                    const last = agentLastActivity[agentId]
                    const status = info.status || 'unknown'
                    const ok = status === 'active' || status === 'healthy'
                    return (
                      <div
                        key={agentId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                          borderRadius: 10, border: '1px solid var(--color-border)', background: '#ffffff',
                          fontSize: '0.82rem',
                        }}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: ok ? '#d9f5e5' : '#fbe3e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Icon size={14} color={ok ? '#0e7c4a' : '#d64550'} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                            <div style={{ fontWeight: 700, color: '#071739', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agentLabel(agentId)}</div>
                            <span style={{ background: ok ? '#d9f5e5' : '#fbe3e5', color: ok ? '#0e7c4a' : '#d64550', fontSize: '0.62rem', fontWeight: 700, padding: '1px 7px', borderRadius: 10, textTransform: 'capitalize' }}>
                              {ok ? 'Healthy' : status}
                            </span>
                          </div>
                          <div style={{ color: '#4a5a75', fontSize: '0.7rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cap} task{(cap !== 1 ? 's' : '')} · {last ? relativeTime(last) : '—'}</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </Card>

            {/* AI status */}
            <AIStatus
              modules={[
                { id: 'face_recognition', name: 'Face Recognition' },
                { id: 'baggage_threat_detection', name: 'Baggage Threat' },
                { id: 'smoke_fire_detection', name: 'Smoke / Fire' },
                { id: 'full_scene_detection', name: 'Full Scene' },
              ]}
              reachable={health.data?.twin?.delivered ?? false}
            />

            {/* IoT status */}
            <IoTStatus byStatus={(iotReport.data && iotReport.data.by_status) || []} devices={(iotReport.data && iotReport.data.recent_health) || []} />

            {/* Security summary */}
            <Card className="lift" title="Security">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f6f8fc', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#4a5a75', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 4 }}>Face Verified</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#071739' }}>{securityReport.data?.verified ?? 0}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f6f8fc', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#4a5a75', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 4 }}>Gate Authorized</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#071739' }}>{securityReport.data?.gate_authorized ?? 0}</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f6f8fc', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#4a5a75', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 4 }}>Verification Rate</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#071739' }}>{((securityReport.data?.verification_rate ?? 0) * 100).toFixed(0)}%</div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 10, background: '#f6f8fc', border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: '0.7rem', color: '#4a5a75', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 4 }}>AI Inspections</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#071739' }}>{ov.inspections ?? 0}</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </FadeIn>
    </div>
  )
}
