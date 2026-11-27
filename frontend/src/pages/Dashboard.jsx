/**
 * Executive Command Dashboard — Airport Operational Overview.
 *
 * Strictly focused on:
 *   Section 1: Operational KPI Cards (Passengers, Active Flights, Baggage Processing,
 *              Open Alerts, Active Agents, System Health)
 *   Section 2: Live Airport Feeds (real camera feeds from /api/v1/monitoring/cameras)
 */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Plane, Luggage, Bell, Cpu, Activity,
  Video, VideoOff, Maximize2, X, RefreshCw, MapPin, ArrowUpRight,
} from 'lucide-react'
import useApi from '../hooks/useApi'
import { Loading, ErrorState } from '../components/States'
import KPICard from '../components/dashboard/KPICard'
import FadeIn from '../components/animations/FadeIn'

function FeedStream({ streamPath, location, status }) {
  const [streamError, setStreamError] = useState(false)
  const isOnline = String(status || '').toLowerCase() === 'online' || String(status || '').toLowerCase() === 'active'
  const hasHttpStream = streamPath && /^https?:\/\//i.test(streamPath)

  if (!isOnline || !hasHttpStream || streamError) {
    return (
      <div style={{
        height: 170,
        borderRadius: 10,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        color: '#cbd5e1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        textAlign: 'center',
        gap: 6,
      }}>
        <VideoOff size={24} color={isOnline ? '#94a3b8' : '#ef4444'} />
        <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f8fafc' }}>
          {!isOnline ? 'Camera Offline' : 'Live Video Stream Unavailable'}
        </div>
        <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
          {!isOnline
            ? `Device status: ${status || 'offline'}`
            : `Stream endpoint (${streamPath || 'unassigned'}) is not broadcasting`}
        </div>
      </div>
    )
  }

  return (
    <img
      src={streamPath}
      alt={`Live feed — ${location}`}
      onError={() => setStreamError(true)}
      style={{
        width: '100%',
        height: 170,
        objectFit: 'cover',
        borderRadius: 10,
        background: '#0f172a',
        display: 'block',
      }}
    />
  )
}

export default function Dashboard() {
  const [nonce, setNonce] = useState(0)
  const [selectedCam, setSelectedCam] = useState(null)
  const retry = useCallback(() => setNonce((n) => n + 1), [])

  const health = useApi('/api/v1/agents/health', [nonce])
  const overview = useApi('/api/v1/reports/overview', [nonce])
  const camerasRes = useApi('/api/v1/monitoring/cameras', [nonce])
  const notifsRes = useApi('/api/v1/agents/notifications?sync=false&status=open', [nonce])

  useEffect(() => {
    const timer = setInterval(() => setNonce((n) => n + 1), 15000)
    return () => clearInterval(timer)
  }, [])

  if (health.loading || overview.loading) {
    return <Loading label="Loading live airport operations…" />
  }
  if (health.error || overview.error) {
    return <ErrorState error={health.error || overview.error} onRetry={retry} />
  }

  const h = health.data || {}
  const overall = h.overall || 'unknown'
  const activeAgents = h.active_agents ?? 0
  const totalAgents = h.agent_count ?? 0
  const healthPct = overall === 'healthy' ? 100 : (overall === 'degraded' ? 70 : 0)

  const ov = overview.data || {}
  const cameras = camerasRes.data?.cameras || []
  const agentOpenAlerts = (notifsRes.data?.notifications || []).length

  const passengerCount = ov.passengers ?? 0
  const activeFlightsCount = ov.flights ?? 0
  const baggageCount = ov.bags ?? 0
  const openAlertsCount = (ov.open_alerts ?? 0) + agentOpenAlerts

  const now = new Date()

  const clickableCardStyle = {
    textDecoration: 'none',
    color: 'inherit',
    display: 'block',
    position: 'relative',
  }

  return (
    <div className="dashboard-page">
      {/* Executive Header */}
      <FadeIn delay={0}>
        <div className="dash-top-row" style={{ marginBottom: 18 }}>
          <div className="dash-welcome">
            <h1>Executive Command Dashboard</h1>
            <p>
              Airport Operational Overview · {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="dash-health-card">
              <div className="health-row">
                <div className="health-dot" style={{ background: overall === 'healthy' ? '#16a34a' : '#d97706' }} />
                <div>
                  <div className="health-title">
                    System {overall.charAt(0).toUpperCase() + overall.slice(1)}
                  </div>
                  <div className="health-sub">
                    {activeAgents}/{totalAgents} active agents · {cameras.length} camera{cameras.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={retry}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 13px',
                borderRadius: 10, border: '1px solid #cbd5e1', background: '#fff',
                color: '#071739', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} /> Refresh
            </button>
          </div>
        </div>
      </FadeIn>

      {/* Section 1 – Operational KPI Cards */}
      <FadeIn delay={40}>
        <section aria-label="Operational KPI Cards" style={{ marginBottom: 24 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 14,
          }}>
            <Link to="/staff/passengers" style={clickableCardStyle} title="Open Passenger Management">
              <KPICard
                icon={Users}
                label="Passengers"
                value={passengerCount}
                sub={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Registered passengers <ArrowUpRight size={13} />
                  </span>
                }
              />
            </Link>

            <Link to="/staff/flights" style={clickableCardStyle} title="Open Active Flights">
              <KPICard
                icon={Plane}
                label="Active Flights"
                value={activeFlightsCount}
                sub={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Scheduled flights <ArrowUpRight size={13} />
                  </span>
                }
              />
            </Link>

            <Link to="/staff/baggage" style={clickableCardStyle} title="Open Baggage Processing">
              <KPICard
                icon={Luggage}
                label="Baggage Processing"
                value={baggageCount}
                sub={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {ov.inspections ? `${ov.inspections} inspections logged` : 'Baggage tracking'} <ArrowUpRight size={13} />
                  </span>
                }
              />
            </Link>

            <Link to="/admin/ai-monitor" style={clickableCardStyle} title="Open Agent Notifications">
              <KPICard
                icon={Bell}
                label="Open Alerts"
                value={openAlertsCount}
                sub={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {ov.active_emergencies ? `${ov.active_emergencies} active emergencies` : 'View notifications'} <ArrowUpRight size={13} />
                  </span>
                }
              />
            </Link>

            <KPICard
              icon={Cpu}
              label="Active Agents"
              value={activeAgents}
              suffix={` / ${totalAgents}`}
              sub="Running AI agents"
            />

            <KPICard
              icon={Activity}
              label="System Health"
              value={healthPct}
              decimals={0}
              suffix="%"
              sub={`Overall status: ${overall}`}
            />
          </div>
        </section>
      </FadeIn>

      {/* Section 2 – Live Airport Feeds */}
      <FadeIn delay={80}>
        <section aria-label="Live Airport Feeds">
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 10, marginBottom: 14,
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.18rem', color: '#071739', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Video size={20} /> Live Airport Feeds
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.84rem', color: '#64748b' }}>
                Real-time camera streams across terminal zones and gates.
              </p>
            </div>
            <span style={{
              fontSize: '0.78rem', fontWeight: 700, padding: '4px 10px', borderRadius: 999,
              background: cameras.length ? '#dcfce7' : '#f1f5f9',
              color: cameras.length ? '#166534' : '#475569',
            }}>
              {cameras.length} {cameras.length === 1 ? 'Camera' : 'Cameras'} Connected
            </span>
          </div>

          {camerasRes.loading ? (
            <Loading label="Loading airport camera feeds…" />
          ) : cameras.length === 0 ? (
            <div style={{
              background: '#fff', border: '1px dashed #cbd5e1', borderRadius: 14,
              padding: 40, textAlign: 'center', color: '#64748b',
            }}>
              <VideoOff size={28} style={{ opacity: 0.45, marginBottom: 8 }} />
              <div style={{ fontWeight: 700, color: '#0f172a' }}>No airport cameras registered</div>
              <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                Register cameras in the database to display live airport video feeds here.
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16,
            }}>
              {cameras.map((cam) => {
                const isOnline = String(cam.status || '').toLowerCase() === 'online' || String(cam.status || '').toLowerCase() === 'active'
                return (
                  <div
                    key={cam.cameraId}
                    style={{
                      background: '#fff',
                      border: '1px solid #e2e8f0',
                      borderRadius: 14,
                      padding: 14,
                      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                          Camera #{cam.cameraId} · {cam.cameraType || 'Surveillance'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                          <MapPin size={12} /> {cam.location || 'Unassigned'} ({cam.zoneName || `Zone ${cam.zoneId ?? '—'}`})
                        </div>
                      </div>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 9px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700,
                        background: isOnline ? '#dcfce7' : '#fee2e2',
                        color: isOnline ? '#166534' : '#991b1b',
                      }}>
                        <span style={{
                          width: 7, height: 7, borderRadius: '50%',
                          background: isOnline ? '#16a34a' : '#dc2626',
                        }} />
                        {isOnline ? 'LIVE' : 'OFFLINE'}
                      </span>
                    </div>

                    <FeedStream streamPath={cam.streamPath} location={cam.location} status={cam.status} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b' }}>
                      <span>{cam.resolution || '1080p'} · {cam.fps || 30} fps · {cam.status || 'unknown'}</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCam(cam)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px',
                          borderRadius: 7, border: '1px solid #cbd5e1', background: '#f8fafc',
                          color: '#0f172a', fontWeight: 600, fontSize: '0.76rem', cursor: 'pointer',
                        }}
                      >
                        <Maximize2 size={13} /> Expand
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </FadeIn>

      {/* Larger Camera View Modal */}
      {selectedCam && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 20,
          }}
        >
          <div style={{
            background: '#fff', borderRadius: 14, maxWidth: 760, width: '100%', padding: 20,
            boxShadow: '0 20px 50px rgba(15, 23, 42, 0.3)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ margin: 0, color: '#071739' }}>
                  Camera #{selectedCam.cameraId} — {selectedCam.location || 'Airport Feed'}
                </h3>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  {selectedCam.zoneName || `Zone ${selectedCam.zoneId ?? '—'}`} · Status: {selectedCam.status || 'unknown'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCam(null)}
                style={{
                  border: '1px solid #cbd5e1', background: '#fff', borderRadius: 8,
                  padding: '6px 8px', cursor: 'pointer',
                }}
                aria-label="Close camera view"
              >
                <X size={16} />
              </button>
            </div>

            <FeedStream streamPath={selectedCam.streamPath} location={selectedCam.location} status={selectedCam.status} />

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, fontSize: '0.82rem', color: '#475569' }}>
              <span><strong>Type:</strong> {selectedCam.cameraType || 'Surveillance'}</span>
              <span><strong>Resolution:</strong> {selectedCam.resolution || '1080p'}</span>
              <span><strong>FPS:</strong> {selectedCam.fps || 30}</span>
              <span><strong>Stream Path:</strong> <code>{selectedCam.streamPath || '—'}</code></span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
