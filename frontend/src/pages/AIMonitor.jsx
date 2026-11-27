/**
 * AI Monitoring — Agent Notifications & Operational Alerts Only.
 *
 * Displays real-time notifications from deployed AI agents across airport devices:
 *   - Offline / unavailable / disconnected from device
 *   - Crashes, model init/execution failures, performance degradation, stalled processing
 *   - Recovery after failure
 *
 * Strict scope: Notifications and operational alerts ONLY.
 */
import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, CheckCheck, RefreshCw, ShieldAlert, AlertTriangle, Info, Wrench } from 'lucide-react'
import { AgentNotificationApi } from '../services/api'
import { Loading, ErrorState } from '../components/States'

const SEVERITY_META = {
  critical: { label: 'Critical', bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', Icon: ShieldAlert },
  warning: { label: 'Warning', bg: '#fffbeb', border: '#fde68a', text: '#b45309', Icon: AlertTriangle },
  info: { label: 'Info', bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8', Icon: Info },
}

const STATUS_BADGE = {
  open: { label: 'Open', bg: '#fee2e2', text: '#991b1b' },
  acknowledged: { label: 'Acknowledged', bg: '#fef3c7', text: '#92400e' },
  resolved: { label: 'Resolved', bg: '#dcfce7', text: '#166534' },
}

export default function AIMonitor() {
  const [notifications, setNotifications] = useState([])
  const [agents, setAgents] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [severityFilter, setSeverityFilter] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const loadNotifications = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const res = await AgentNotificationApi.list({
        severity: severityFilter,
        agent_name: agentFilter,
        status: statusFilter,
        sync: true,
      })
      const data = res?.data || res || {}
      setNotifications(data.notifications || [])
      setAgents(data.agents || [])
      setUnreadCount(data.unread_count ?? 0)
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [severityFilter, agentFilter, statusFilter])

  useEffect(() => {
    loadNotifications(true)
    const timer = setInterval(() => loadNotifications(false), 10000)
    return () => clearInterval(timer)
  }, [loadNotifications])

  const handleAction = async (id, fn) => {
    setBusyId(id)
    try {
      await fn(id)
      await loadNotifications(false)
    } finally {
      setBusyId(null)
    }
  }

  const handleMarkAllRead = async () => {
    setBusyId('all')
    try {
      await AgentNotificationApi.markAllRead()
      await loadNotifications(false)
    } finally {
      setBusyId(null)
    }
  }

  if (loading && notifications.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h1>AI Agent Notifications</h1>
        <Loading label="Loading agent notifications…" />
      </div>
    )
  }

  if (error && notifications.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <h1>AI Agent Notifications</h1>
        <ErrorState error={error} onRetry={() => loadNotifications(true)} />
      </div>
    )
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1120, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: '1.5rem' }}>
            <Bell size={22} />
            AI Agent Notifications
            {unreadCount > 0 && (
              <span style={{
                background: '#dc2626', color: '#fff', fontSize: '0.75rem', fontWeight: 700,
                padding: '2px 9px', borderRadius: 999,
              }}>
                {unreadCount} unread
              </span>
            )}
          </h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>
            Real-time operational alerts for deployed AI agents across airport devices.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={busyId === 'all' || unreadCount === 0}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600, opacity: unreadCount === 0 ? 0.5 : 1,
            }}
          >
            <CheckCheck size={15} /> Mark all read
          </button>
          <button
            type="button"
            onClick={() => loadNotifications(false)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px',
              borderRadius: 8, border: 'none', background: '#071739', color: '#fff', cursor: 'pointer',
              fontSize: '0.85rem', fontWeight: 600,
            }}
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center',
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px', marginBottom: 16,
      }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
          Severity:{' '}
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} style={{ marginLeft: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </label>

        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
          Agent:{' '}
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={{ marginLeft: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
            <option value="">All Agents</option>
            {agents.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
          Alert Status:{' '}
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ marginLeft: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1' }}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div style={{
          padding: 40, textAlign: 'center', border: '1px dashed #cbd5e1', borderRadius: 12,
          color: '#64748b', background: '#fff',
        }}>
          <Bell size={28} style={{ opacity: 0.4, marginBottom: 8 }} />
          <div style={{ fontWeight: 600, color: '#334155' }}>No agent notifications match the current filters</div>
          <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
            Notifications appear automatically when deployed AI agents go offline, fail, degrade, disconnect, or recover.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {notifications.map((n) => {
            const sev = SEVERITY_META[n.severity] || SEVERITY_META.info
            const st = STATUS_BADGE[n.status] || STATUS_BADGE.open
            const SevIcon = sev.Icon
            const isBusy = busyId === n.notification_id
            return (
              <div
                key={n.notification_id}
                style={{
                  background: '#fff',
                  border: `1px solid ${n.is_read ? '#e2e8f0' : sev.border}`,
                  borderLeft: `4px solid ${sev.text}`,
                  borderRadius: 10,
                  padding: '14px 16px',
                  boxShadow: n.is_read ? 'none' : '0 2px 8px rgba(15, 23, 42, 0.05)',
                  opacity: n.status === 'resolved' ? 0.78 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: sev.bg, color: sev.text, border: `1px solid ${sev.border}`,
                      padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                    }}>
                      <SevIcon size={13} /> {sev.label}
                    </span>
                    <strong style={{ fontSize: '0.98rem', color: '#0f172a' }}>{n.agent_name}</strong>
                    {!n.is_read && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb', display: 'inline-block' }} title="Unread" />
                    )}
                    <span style={{ background: st.bg, color: st.text, padding: '2px 8px', borderRadius: 6, fontSize: '0.74rem', fontWeight: 600 }}>
                      {st.label}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {n.created_at ? new Date(n.created_at).toLocaleString() : '—'}
                  </span>
                </div>

                <p style={{ margin: '8px 0', color: '#1e293b', fontSize: '0.92rem' }}>{n.description}</p>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569', marginBottom: n.recommended_action ? 8 : 0 }}>
                  <span><strong>Model / Task:</strong> {n.model_name}</span>
                  <span><strong>Device ID:</strong> {n.device_id != null ? `#${n.device_id}${n.device_label ? ` (${n.device_label})` : ''}` : 'Host'}</span>
                  <span><strong>Agent Status:</strong> {n.agent_status}</span>
                </div>

                {n.recommended_action && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem',
                    color: '#0f172a', background: '#f8fafc', padding: '6px 10px', borderRadius: 6, marginTop: 6,
                  }}>
                    <Wrench size={14} color="#475569" />
                    <span><strong>Recommended Action:</strong> {n.recommended_action}</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {!n.is_read && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(n.notification_id, AgentNotificationApi.markRead)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
                        borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', fontSize: '0.78rem',
                      }}
                    >
                      <Check size={13} /> Mark Read
                    </button>
                  )}
                  {n.status === 'open' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(n.notification_id, AgentNotificationApi.acknowledge)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, border: '1px solid #f59e0b',
                        background: '#fffbeb', color: '#92400e', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                      }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {n.status !== 'resolved' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleAction(n.notification_id, AgentNotificationApi.resolve)}
                      style={{
                        padding: '5px 10px', borderRadius: 6, border: '1px solid #16a34a',
                        background: '#f0fdf4', color: '#166534', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600,
                      }}
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
