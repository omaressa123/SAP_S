/**
 * Event Center — view and filter recent airport events from the agent
 * event system. Shows model results, confidence scores, decision audit,
 * review status, and Digital Twin delivery status where available.
 *
 * Data source: GET /api/v1/agents/events with query filters for
 * event_type, severity, status, source, limit.
 */
import { useCallback, useState } from 'react'
import { Filter, Search } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { api } from '../services/api'
import PulseDot from '../components/animations/PulseDot'

const EVENT_TYPE_LABEL = {
  face_verify: 'Face Verify',
  passport_scan: 'Passport Scan',
  baggage_scan: 'Baggage Scan',
  baggage_tracking: 'Baggage Tracking',
  smoke_detected: 'Smoke Detected',
  fire_detected: 'Fire Detected',
  fall_detected: 'Fall Detected',
  restricted_area: 'Restricted Area',
  unattended_bag: 'Unattended Bag',
  overcrowding: 'Overcrowding',
  iot_telemetry: 'IoT Telemetry',
}

const SEVERITY_COLOR = {
  critical: '#d64550',
  high: '#c77b1a',
  medium: '#e2a13a',
  low: '#0e7c4a',
  info: '#4a5a75',
}

const STATUS_COLOR = {
  resolved: '#0e7c4a',
  processing: '#c77b1a',
  received: '#4a5a75',
  dismissed: '#8b93a7',
}

const SOURCE_ICON = {
  ai_service: BrainCircuit,
  iot_device: Radio,
  api: ShieldAlert,
  agent: Luggage,
  system: Clock,
}

export default function EventCenter() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])
  const [filters, setFilters] = useState({
    event_type: '',
    severity: '',
    status: '',
    source: '',
  })

  const events = useApi(
    '/api/v1/agents/events',
    [nonce, filters.event_type, filters.severity, filters.status, filters.source]
  )

  if (events.loading) {
    return (
      <div className="ops-bg">
        <h1>Event Center</h1>
        <Loading />
      </div>
    )
  }
  if (events.error) {
    return (
      <div className="ops-bg">
        <h1>Event Center</h1>
        <ErrorState error={events.error} onRetry={retry} />
      </div>
    )
  }

  const rows = events.data || []

  return (
    <div className="ops-bg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1>Event Center</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            className="btn"
            onClick={() => setFilters({ event_type: '', severity: '', status: '', source: '' })}
          >
            Clear filters
          </button>
          <button className="btn accent" onClick={retry}>
            <Search size={16} /> Refresh
          </button>
        </div>
      </div>

      <FadeIn delay={0}>
        <Card className="lift" title="Filter Events">
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 0.25, fontSize: '0.85rem', color: '#4a5a75' }}>Event type</span>
              <select
                value={filters.event_type}
                onChange={(e) => setFilters({ ...filters, event_type: e.target.value })}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
              >
                <option value="">All types</option>
                <option value="face_verify">Face Verify</option>
                <option value="passport_scan">Passport Scan</option>
                <option value="baggage_scan">Baggage Scan</option>
                <option value="baggage_tracking">Baggage Tracking</option>
                <option value="smoke_detected">Smoke Detected</option>
                <option value="fire_detected">Fire Detected</option>
                <option value="fall_detected">Fall Detected</option>
                <option value="restricted_area">Restricted Area</option>
                <option value="unattended_bag">Unattended Bag</option>
                <option value="overcrowding">Overcrowding</option>
                <option value="iot_telemetry">IoT Telemetry</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 0.25, fontSize: '0.85rem', color: '#4a5a75' }}>Severity</span>
              <select
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
              >
                <option value="">All severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="info">Info</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 0.25, fontSize: '0.85rem', color: '#4a5a75' }}>Status</span>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
              >
                <option value="">All statuses</option>
                <option value="received">Received</option>
                <option value="processing">Processing</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ flex: 0.25, fontSize: '0.85rem', color: '#4a5a75' }}>Source</span>
              <select
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
              >
                <option value="">All sources</option>
                <option value="api">API</option>
                <option value="ai_service">AI Service</option>
                <option value="iot_device">IoT Device</option>
                <option value="agent">Agent</option>
                <option value="system">System</option>
              </select>
            </div>
          </div>
        </Card>
      </FadeIn>

      <FadeIn delay={200}>
        <Card className="lift" title={`Events (${rows.length})`}>
          <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
            {rows.length === 0 ? (
              <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '24px', textAlign: 'center' }}>
                No events match the current filters.
              </p>
            ) : (
              rows.map((evt) => (
                <div
                  key={evt.event_id}
                  style={{
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    padding: '10px 14px',
                    background: '#ffffff',
                    borderBottom: '1px solid var(--color-border)',
                    fontSize: '0.85rem',
                  }}
                >
                  <PulseDot status={evt.status} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#071739' }}>{EVENT_TYPE_LABEL[evt.event_type] || evt.event_type}</div>
                    <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginTop: 2 }}>
                      Source: {evt.source} &nbsp;|&nbsp; Severity: {evt.severity} &nbsp;|&nbsp; Correlation: {evt.correlation_id}
                    </div>
                    <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginTop: 2 }}>
                      {evt.created_at ? new Date(evt.created_at).toLocaleString() : '—'}
                    </div>
                  </div>
                  <span style={{ color: STATUS_COLOR[evt.status] || '#4a5a75', fontWeight: 600, fontSize: '0.75rem' }}>{evt.status}</span>
                </div>
              ))
            )}
          </div>
        </Card>
      </FadeIn>
    </div>
  )
}

import FadeIn from '../components/animations/FadeIn'
import { Loading, EmptyState, ErrorState } from '../components/States'