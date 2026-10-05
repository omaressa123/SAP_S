import { useCallback, useState } from 'react'
import { Plane, Users, Luggage, ShieldCheck, BrainCircuit, Radio, TriangleAlert } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { Loading, EmptyState, ErrorState, StatCard, BarChart } from '../components/States'
import FadeIn from '../components/animations/FadeIn'
import KPICard from '../components/dashboard/KPICard'
import LiveActivity from '../components/dashboard/LiveActivity'
import IoTStatus from '../components/dashboard/IoTStatus'
import AIStatus from '../components/dashboard/AIStatus'
import FlightStrip from '../components/dashboard/FlightStrip'

export default function Dashboard() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])
  const overview = useApi('/api/v1/reports/overview', [nonce])
  const flights = useApi('/api/v1/reports/flights', [nonce])
  const baggage = useApi('/api/v1/reports/baggage', [nonce])
  const security = useApi('/api/v1/reports/security', [nonce])
  const iot = useApi('/api/v1/reports/iot', [nonce])
  const ai = useApi('/api/v1/ai/registry', [nonce])

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

  const stats = [
    { icon: Users, label: 'Passengers', value: o.passengers ?? 0, sub: 'registered travelers' },
    { icon: Plane, label: 'Flights', value: o.flights ?? 0, sub: 'scheduled operations' },
    { icon: Luggage, label: 'Bags', value: o.bags ?? 0, sub: 'tracked baggage' },
    { icon: ShieldCheck, label: 'Face verifications', value: o.face_verifications ?? 0, sub: 'biometric checks' },
    { icon: TriangleAlert, label: 'Open alerts', value: o.open_alerts ?? 0, sub: 'needs attention' },
    { icon: Radio, label: 'Devices', value: o.devices ?? 0, sub: 'IoT endpoints' },
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
          <Card title="AI Command Center">
            <p><BrainCircuit size={18} /> Open the AI Center for live inference modules.</p>
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}
