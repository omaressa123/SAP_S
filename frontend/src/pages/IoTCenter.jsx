import { useState } from 'react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import FadeIn from '../components/animations/FadeIn'
import PulseDot from '../components/animations/PulseDot'
import { BarChart, EmptyState, ErrorState, Loading } from '../components/States'
import { EventTimeline, StatusBadge } from '../components/ai/AiVisuals'

const KNOWN_MODULES = ['Smart Gate', 'Passenger Counter', 'Smart Baggage', 'Fire Detection', 'Environment', 'Smart Elevator', 'Aircraft Parking']

export default function IoTCenter() {
  const [status, setStatus] = useState('')
  const { data, error, loading } = useApi('/api/v1/reports/iot', [])
  if (loading) return <Loading label="Loading device telemetry…" />
  if (error) return (<><h1>IoT Center</h1><ErrorState error={error} /></>)
  if (!data) return (<><h1>IoT Center</h1><EmptyState /></>)
  const health = (data.recent_health || []).filter((h) => !status || h.status_result === status)
  return (
    <>
      <h1>IoT Center</h1>
      <Card title="MQTT → Backend → PostgreSQL → Dashboard">
        <p>ESP32 modules publish to <code>airport/#module/#device/#event</code>; the backend MQTT bridge persists telemetry and emergency events.</p>
        <label>Status filter:{' '}
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">all</option>
            <option value="ok">ok</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </label>
      </Card>
      <FadeIn delay={120}>
        <Card title="Telemetry Link">
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <PulseDot status={(data.by_status || []).length ? 'online' : 'offline'} label={(data.by_status || []).length ? 'Telemetry flowing' : 'No telemetry'} />
            <span style={{ color: '#4a5a75', fontSize: '0.85rem' }}>
              Modules: {KNOWN_MODULES.join(' · ')} — per-device state appears below as the MQTT bridge reports.
            </span>
          </div>
        </Card>
      </FadeIn>
      <BarChart title="Devices by status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
      <Card title={`Telemetry events (${health.length})`}>
        {!health.length ? <EmptyState hint="no telemetry in database" /> : (
          <>
            <p><StatusBadge tone="live">{health.length} EVENTS IN DATABASE</StatusBadge></p>
            <EventTimeline
              emptyHint="no telemetry in database"
              events={health.slice(0, 50).map((h) => ({
                title: `Equipment ${h.equipment_id} — ${h.metric_type}: ${h.value}`,
                detail: h.status_result, time: h.check_time,
                severity: h.status_result === 'ok' ? 'low' : 'high',
                badge: h.status_result?.toUpperCase(), tone: h.status_result === 'ok' ? 'good' : 'bad',
              }))}
            />
          </>
        )}
      </Card>
    </>
  )
}
