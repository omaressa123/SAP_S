/**
 * Event Center — view and filter recent airport events from the agent
 * event system. Shows model results, confidence scores, decision audit,
 * review status, and Digital Twin delivery status where available.
 *
 * Data source: GET /api/v1/agents/events with query filters for
 * event_type, severity, status, source, limit.
 */
import { useCallback, useState } from 'react'
import { Filter, Search, ArrowRight, RefreshCw } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { api } from '../services/api'
import { Loading, ErrorState } from '../components/States'
import PulseDot from '../components/animations/PulseDot'
import FadeIn from '../components/animations/FadeIn'

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

const FILTER_OPTIONS = {
  event_type: [
    { value: 'face_verify', label: 'Face Verify' },
    { value: 'passport_scan', label: 'Passport Scan' },
    { value: 'baggage_scan', label: 'Baggage Scan' },
    { value: 'baggage_tracking', label: 'Baggage Tracking' },
    { value: 'smoke_detected', label: 'Smoke Detected' },
    { value: 'fire_detected', label: 'Fire Detected' },
    { value: 'fall_detected', label: 'Fall Detected' },
    { value: 'restricted_area', label: 'Restricted Area' },
    { value: 'unattended_bag', label: 'Unattended Bag' },
    { value: 'overcrowding', label: 'Overcrowding' },
    { value: 'iot_telemetry', label: 'IoT Telemetry' },
  ],
  severity: [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
    { value: 'info', label: 'Info' },
  ],
  status: [
    { value: 'received', label: 'Received' },
    { value: 'processing', label: 'Processing' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' },
  ],
  source: [
    { value: 'api', label: 'API' },
    { value: 'ai_service', label: 'AI Service' },
    { value: 'iot_device', label: 'IoT Device' },
    { value: 'agent', label: 'Agent' },
    { value: 'system', label: 'System' },
  ],
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
    <div className="dashboard-page">
      <FadeIn delay={0}>
        <div className="dash-top-row">
          <div className="dash-welcome">
            <h1>Event Center</h1>
            <p>View, filter, and track airport events from the agent event system.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn"
              onClick={() => setFilters({ event_type: '', severity: '', status: '', source: '' })}
            >
              <RefreshCw size={14} /> Clear filters
            </button>
            <button className="btn accent" onClick={retry}>
              <Search size={14} /> Refresh
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Filter chips */}
      <FadeIn delay={60}>
        <Card className="lift" title="Filter Events">
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {Object.entries(FILTER_OPTIONS).map(([key, options]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.7rem', color: '#4a5a75', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{key.replace(/_/g, ' ')}</span>
                <select
                  value={filters[key]}
                  onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
                  style={{
                    fontSize: '0.78rem',
                    padding: '6px 10px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#071739',
                    minWidth: 130,
                  }}
                >
                  <option value="">All {key.replace(/_/g, ' ')}s</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </Card>
      </FadeIn>

      {/* Events list */}
      <FadeIn delay={120}>
        <Card className="lift" title={`Events (${rows.length})`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.length === 0 ? (
              <p style={{ color: '#4a5a75', fontSize: '0.8rem', padding: '16px', textAlign: 'center' }}>
                No events match the current filters.
              </p>
            ) : (
              rows.map((evt) => {
                const et = EVENT_TYPE_LABEL[evt.event_type] || evt.event_type
                return (
                  <div
                    key={evt.event_id}
                    style={{
                      display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px',
                      borderRadius: 10, border: '1px solid var(--color-border)', background: '#ffffff',
                      fontSize: '0.82rem',
                    }}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eef0fa' }}>
                      <PulseDot status={evt.status} pulse={false} style={{ transform: 'scale(1.1)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{et}</div>
                      <div style={{ color: '#4a5a75', fontSize: '0.72rem', marginTop: 2 }}>
                        <span style={{ whiteSpace: 'nowrap' }}>Source: {evt.source}</span>
                        <span style={{ margin: '0 6px', color: '#bfc7d2' }}>|</span>
                        <span style={{ whiteSpace: 'nowrap', color: SEVERITY_COLOR[evt.severity] || '#4a5a75', fontWeight: 600 }}>{evt.severity}</span>
                        <span style={{ margin: '0 6px', color: '#bfc7d2' }}>|</span>
                        <span style={{ whiteSpace: 'nowrap' }}>Corr: {evt.correlation_id || '—'}</span>
                      </div>
                      <div style={{ color: '#4a5a75', fontSize: '0.72rem', marginTop: 2 }}>
                        {evt.created_at ? new Date(evt.created_at).toLocaleString() : '—'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                      <div style={{ color: '#4a5a75', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{relativeTime(evt.created_at)}</div>
                      <span style={{ color: STATUS_COLOR[evt.status] || '#4a5a75', fontWeight: 600, fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{evt.status}</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </FadeIn>
    </div>
  )
}
