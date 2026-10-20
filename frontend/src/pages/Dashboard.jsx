import { useCallback, useState } from 'react'
import { Plane, Users, Luggage, ShieldCheck, BrainCircuit, Radio, TriangleAlert, Server, Activity, Wifi } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { Loading, EmptyState, ErrorState, StatCard, BarChart } from '../components/States'
import FadeIn from '../components/animations/FadeIn'
import KPICard from '../components/dashboard/KPICard'
import LiveActivity from '../components/dashboard/LiveActivity'
import IoTStatus from '../components/dashboard/IoTStatus'
import AIStatus from '../components/dashboard/AIStatus'
import FlightStrip from '../components/dashboard/FlightStrip'
import PulseDot from '../components/animations/PulseDot'

export default function Dashboard() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])
  const overview = useApi('/api/v1/reports/overview', [nonce])
  const flights = useApi('/api/v1/reports/flights', [nonce])
  const baggage = useApi('/api/v1/reports/baggage', [nonce])
  const security = useApi('/api/v1/reports/security', [nonce])
  const iot = useApi('/api/v1/reports/iot', [nonce])
  const ai = useApi('/api/v1/ai/registry', [nonce])
  const agentHealth = useApi('/api/v1/agents/health', [nonce])
  const workflows = useApi('/api/v1/agents/workflows?limit=10', [nonce])

  if (overview.loading) return (
    <div className="ops-bg">
      <h1>Smart Airport Operations Center</h1>
      <Loading />
    </div>
  )
  if (overview.error) return (
    <div className="ops-bg">
      <h1>Smart Airport Operations Center</h1>
      <ErrorState error={overview.error} onRetry={retry} />
    </div>
  )
  const o = overview.data || {}
  if (!o || Object.keys(o).length === 0) return (
    <div className="ops-bg">
      <h1>Smart Airport Operations Center</h1>
      <EmptyState hint="database is empty" />
    </div>
  )

  // Twin connectivity status
  const twinHealth = agentHealth.data?.twin || { delivered: false, error: null, auth_error: false }
  const agentStats = agentHealth.data?.agent_statuses || {}
  const activeAgents = agentHealth.data?.active_agents ?? 0
  const totalAgents = agentHealth.data?.agent_count ?? 0

  const stats = [
    { icon: Users, label: 'Passengers', value: o.passengers ?? 0, sub: 'registered travelers' },
    { icon: Plane, label: 'Flights', value: o.flights ?? 0, sub: 'scheduled operations' },
    { icon: Luggage, label: 'Bags', value: o.bags ?? 0, sub: 'tracked baggage' },
    { icon: ShieldCheck, label: 'Face verifications', value: o.face_verifications ?? 0, sub: 'biometric checks' },
    { icon: TriangleAlert, label: 'Open alerts', value: o.open_alerts ?? 0, sub: 'needs attention' },
    { icon: Radio, label: 'Devices', value: o.devices ?? 0, sub: 'IoT endpoints' },
    { icon: Server, label: 'Agents', value: activeAgents, sub: `of ${totalAgents} active` },
    { icon: Wifi, label: 'Digital Twin', value: twinHealth.delivered ? 1 : 0, sub: twinHealth.delivered ? 'connected' : 'disconnected' },
  ]
  return (
    <div className="ops-bg">
      <FadeIn delay={0}><h1>Smart Airport Operations Center</h1></FadeIn>

      <div className="dash-grid">
        {stats.map((s, i) => (
          <FadeIn key={s.label} delay={60 + i * 70}>
            <KPICard icon={s.icon} label={s.label} value={s.value} sub={s.sub} />
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={480}>
        <div style={{ marginTop: 12 }}>
          <FlightStrip flights={flights.data?.flights || []} />
        </div>
      </FadeIn>

      <div className="dash-grid-2">
        <FadeIn delay={540}>
          <BarChart title="Flight status distribution" rows={(flights.data?.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
        </FadeIn>
        <FadeIn delay={620}>
          <BarChart title="Baggage by status" rows={(baggage.data?.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
        </FadeIn>
      </div>

      <div className="dash-grid-2">
        <FadeIn delay={700}>
          <StatCard label="Verification rate" value={security.data ? Math.round(100 * (security.data.verification_rate || 0)) : NaN} suffix="%" sub="successful face matches" />
        </FadeIn>
        <FadeIn delay={760}>
          <StatCard label="Active emergencies" value={o.active_emergencies ?? 0} sub="AI + IoT Monitoring" />
        </FadeIn>
      </div>

      <div className="dash-grid-2">
        <FadeIn delay={820}>
          <LiveActivity />
        </FadeIn>
        <FadeIn delay={880}>
          <IoTStatus byStatus={iot.data?.by_status || []} devices={[]} />
        </FadeIn>
      </div>

      <div className="dash-grid-2">
        <FadeIn delay={940}>
          <AIStatus modules={ai.data?.modules || []} reachable={!ai.error && !!ai.data} />
        </FadeIn>
        <FadeIn delay={1000}>
          <Card title="Agent & Twin Health">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(agentStats).map(([agentId, info]) => (
                <div key={agentId} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#f6f8fc', borderRadius: 8, fontSize: '0.85rem' }}>
                  <PulseDot status={info.status === 'active' ? 'online' : 'offline'} label={info.status} />
                  <span style={{ flex: 1 }}>{agentId.replace('_', ' ')}</span>
                  <span style={{ color: '#4a5a75', fontSize: '0.75rem' }}>{info.capabilities.join(', ')}</span>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#f6f8fc', borderRadius: 8, fontSize: '0.85rem' }}>
                <PulseDot status={twinHealth.delivered ? 'online' : 'offline'} label="Digital Twin" />
                <span style={{ flex: 1 }}>Digital Twin</span>
                <span style={{ color: twinHealth.auth_error ? '#d64550' : '#4a5a75', fontSize: '0.75rem' }}>
                  {twinHealth.auth_error ? 'Auth error' : twinHealth.delivered ? 'Connected' : twinHealth.error || 'Disconnected'}
                </span>
              </div>
            </div>
          </Card>
        </FadeIn>
        <FadeIn delay={1040}>
          <Card title="Recent Workflows">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(workflows.data || []).slice(0, 6).map((wf) => (
                <div key={wf.workflow_id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem' }}>
                  <span style={{ flex: 0.3, fontWeight: 600 }}>{wf.name}</span>
                  <span style={{ flex: 0.2, color: wf.status === 'completed' ? '#0e7c4a' : wf.status === 'failed' ? '#d64550' : '#c77b1a' }}>{wf.status}</span>
                  <span style={{ flex: 0.3, fontSize: '0.75rem', color: '#4a5a75', overflow: 'hidden', textOverflow: 'ellipsis' }}>{wf.correlation_id}</span>
                  <span style={{ flex: 0.2, fontSize: '0.75rem', color: '#4a5a75' }}>{wf.current_step || '-'}</span>
                </div>
              ))}
              {(workflows.data || []).length === 0 && <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '12px' }}>No recent workflows</p>}
            </div>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
