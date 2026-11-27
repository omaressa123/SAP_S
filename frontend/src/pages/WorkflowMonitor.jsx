/**
 * Multi-Agent Workflow Management — Central AI Orchestration.
 *
 * Interactive visual workflow canvas representing real deployed AI agents,
 * their underlying models, assigned airport devices, directional data-flow
 * connections, and lifecycle controls (Create, Stop, Restart, Repair, Duplicate, Remove).
 */
import { useCallback, useEffect, useState } from 'react'
import {
  GitBranch, Plus, RefreshCw, Play, Square, Wrench, Copy, Trash2,
  HardDrive, Cpu, AlertTriangle, CheckCircle2,
} from 'lucide-react'
import { OrchestrationApi } from '../services/api'
import { Loading, ErrorState } from '../components/States'
import '../styles/WorkflowMonitor.css'

const STATUS_STYLE = {
  running: { bg: '#dcfce7', text: '#166534', conn: '#16a34a', label: 'Running' },
  active: { bg: '#dcfce7', text: '#166534', conn: '#16a34a', label: 'Running' },
  idle: { bg: '#fef3c7', text: '#92400e', conn: '#d97706', label: 'Idle' },
  degraded: { bg: '#fef3c7', text: '#92400e', conn: '#d97706', label: 'Degraded' },
  failed: { bg: '#fee2e2', text: '#991b1b', conn: '#dc2626', label: 'Failed' },
  offline: { bg: '#f1f5f9', text: '#475569', conn: '#94a3b8', label: 'Offline' },
  stopped: { bg: '#f1f5f9', text: '#475569', conn: '#94a3b8', label: 'Stopped' },
}

const CONN_COLOR = {
  active: '#16a34a',
  warning: '#d97706',
  failed: '#dc2626',
  inactive: '#94a3b8',
}

function DirectionalArrow({ state = 'inactive' }) {
  const color = CONN_COLOR[state] || CONN_COLOR.inactive
  const dashed = state === 'inactive' || state === 'warning'
  return (
    <svg width="46" height="24" viewBox="0 0 46 24" aria-hidden>
      <line
        x1="2" y1="12" x2="36" y2="12"
        stroke={color} strokeWidth="2.5"
        strokeDasharray={dashed ? '4 3' : undefined}
      />
      <polygon points="36,7 45,12 36,17" fill={color} />
    </svg>
  )
}

export default function WorkflowMonitor() {
  const [deployments, setDeployments] = useState([])
  const [runtimeAgents, setRuntimeAgents] = useState([])
  const [connections, setConnections] = useState([])
  const [models, setModels] = useState([])
  const [devices, setDevices] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  // Modals
  const [showCreate, setShowCreate] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [showDupModal, setShowDupModal] = useState(false)

  // Create Agent form
  const [formModel, setFormModel] = useState('')
  const [formDevice, setFormDevice] = useState('')
  const [formName, setFormName] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formInput, setFormInput] = useState('')
  const [formOutput, setFormOutput] = useState('')

  // Register Device form
  const [devLabel, setDevLabel] = useState('')
  const [devType, setDevType] = useState('camera')
  const [devSerial, setDevSerial] = useState('')
  const [devLocation, setDevLocation] = useState('')

  // Duplicate form
  const [dupDeviceId, setDupDeviceId] = useState('')
  const [dupName, setDupName] = useState('')

  const loadAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true)
    try {
      const [depRes, modRes, devRes] = await Promise.all([
        OrchestrationApi.getDeployments(true),
        OrchestrationApi.getModels(),
        OrchestrationApi.getDevices(),
      ])
      const depData = depRes?.data || depRes || {}
      const list = depData.deployments || []
      setDeployments(list)
      setRuntimeAgents(depData.runtime_agents || [])
      setConnections(depData.connections || [])
      setModels(modRes?.data || modRes || [])
      setDevices(devRes?.data || devRes || [])
      setSelectedId((prev) => (prev && list.some((d) => d.deployment_id === prev) ? prev : list[0]?.deployment_id || null))
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll(true)
    const timer = setInterval(() => loadAll(false), 12000)
    return () => clearInterval(timer)
  }, [loadAll])

  const selected = deployments.find((d) => d.deployment_id === selectedId) || null
  const failedDeployments = deployments.filter((d) => d.status === 'failed' || d.status === 'offline')

  const openCreateModal = () => {
    const firstModel = models[0]
    setFormModel(firstModel?.id || '')
    setFormDevice(devices[0]?.equipment_id ? String(devices[0].equipment_id) : '')
    setFormName(firstModel ? `${firstModel.agent_type} #${deployments.length + 1}` : '')
    setFormLocation('')
    setFormInput(firstModel?.default_input || '')
    setFormOutput(firstModel?.default_output || '')
    setShowCreate(true)
  }

  const onModelChange = (modelId) => {
    setFormModel(modelId)
    const m = models.find((x) => x.id === modelId)
    if (m) {
      setFormName(`${m.agent_type} #${deployments.length + 1}`)
      setFormInput(m.default_input || '')
      setFormOutput(m.default_output || '')
    }
  }

  const handleCreateAgent = async (e) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const res = await OrchestrationApi.createDeployment({
        agent_name: formName,
        model_id: formModel,
        device_id: formDevice ? Number(formDevice) : null,
        location: formLocation || null,
        input_source: formInput || null,
        output_destination: formOutput || null,
      })
      const created = res?.data || res
      setShowCreate(false)
      setNotice({ ok: true, text: `Agent "${created.agent_name}" deployed (${created.status}).` })
      await loadAll(false)
      if (created?.deployment_id) setSelectedId(created.deployment_id)
    } catch (err) {
      setNotice({ ok: false, text: err.message || 'Failed to deploy agent.' })
    } finally {
      setBusy(false)
    }
  }

  const handleRegisterDevice = async (e) => {
    e.preventDefault()
    setBusy(true)
    setNotice(null)
    try {
      const res = await OrchestrationApi.registerDevice({
        label: devLabel,
        equipment_type: devType,
        serial_number: devSerial,
        location: devLocation || null,
        status: 'operational',
      })
      const created = res?.data || res
      setShowDeviceModal(false)
      setDevLabel('')
      setDevSerial('')
      setDevLocation('')
      setNotice({ ok: true, text: `Device "${created.label}" (#${created.equipment_id}) registered.` })
      await loadAll(false)
    } catch (err) {
      setNotice({ ok: false, text: err.message || 'Failed to register device.' })
    } finally {
      setBusy(false)
    }
  }

  const handleLifecycle = async (action, dep) => {
    if (!dep) return
    setBusy(true)
    setNotice(null)
    try {
      if (action === 'stop') {
        await OrchestrationApi.stopDeployment(dep.deployment_id)
        setNotice({ ok: true, text: `Stopped "${dep.agent_name}".` })
      } else if (action === 'restart') {
        const res = await OrchestrationApi.restartDeployment(dep.deployment_id)
        const d = res?.data || res
        setNotice({ ok: d.status === 'running', text: `Restarted "${dep.agent_name}" → ${d.status}.` })
      } else if (action === 'repair') {
        const res = await OrchestrationApi.repairDeployment(dep.deployment_id)
        const r = res?.data || res
        setNotice({
          ok: !!r.repaired,
          text: r.repaired
            ? `Agent "${dep.agent_name}" repaired and running.`
            : `Manual intervention required: ${(r.issues || []).join('; ')}`,
        })
      } else if (action === 'remove') {
        if (!window.confirm(`Remove agent "${dep.agent_name}" from this device? (Underlying AI model is preserved.)`)) {
          setBusy(false)
          return
        }
        await OrchestrationApi.removeDeployment(dep.deployment_id)
        setNotice({ ok: true, text: `Removed agent "${dep.agent_name}".` })
        setSelectedId(null)
      }
      await loadAll(false)
    } catch (err) {
      setNotice({ ok: false, text: err.message || `Action "${action}" failed.` })
    } finally {
      setBusy(false)
    }
  }

  const handleDuplicate = async (e) => {
    e.preventDefault()
    if (!selected || !dupDeviceId) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await OrchestrationApi.duplicateDeployment(selected.deployment_id, {
        device_id: Number(dupDeviceId),
        agent_name: dupName || undefined,
      })
      const created = res?.data || res
      setShowDupModal(false)
      setNotice({ ok: true, text: `Deployed "${created.agent_name}" to device #${dupDeviceId}.` })
      await loadAll(false)
      if (created?.deployment_id) setSelectedId(created.deployment_id)
    } catch (err) {
      setNotice({ ok: false, text: err.message || 'Duplicate/deploy failed.' })
    } finally {
      setBusy(false)
    }
  }

  if (loading && deployments.length === 0 && models.length === 0) {
    return (
      <div className="wf-page">
        <Loading label="Loading Multi-Agent Workflow…" />
      </div>
    )
  }
  if (error && models.length === 0) {
    return (
      <div className="wf-page">
        <ErrorState error={error} onRetry={() => loadAll(true)} />
      </div>
    )
  }

  return (
    <div className="wf-page">
      {/* Header */}
      <div className="wf-header">
        <div>
          <h1><GitBranch size={22} /> Multi-Agent Workflow Orchestration</h1>
          <p>
            Visual deployment topology across airport devices · {models.length} AI models · {devices.length} devices · {deployments.length} deployed agents
          </p>
        </div>
        <div className="wf-toolbar">
          <button type="button" className="wf-btn" onClick={() => setShowDeviceModal(true)}>
            <HardDrive size={15} /> Register Device
          </button>
          <button type="button" className="wf-btn wf-btn-primary" onClick={openCreateModal}>
            <Plus size={15} /> Create &amp; Deploy Agent
          </button>
          <button type="button" className="wf-btn" onClick={() => loadAll(false)} disabled={busy}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Action feedback */}
      {notice && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, marginBottom: 12,
          background: notice.ok ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${notice.ok ? '#bbf7d0' : '#fecaca'}`,
          color: notice.ok ? '#166534' : '#991b1b',
          fontSize: '0.86rem', fontWeight: 600,
        }}>
          {notice.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Intelligent Failure Alert Banner */}
      {failedDeployments.length > 0 && (
        <div className="wf-alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={17} />
            <strong>{failedDeployments.length} agent(s) require attention:</strong>
            <span>{failedDeployments.map((d) => `${d.agent_name} (${d.status})`).join(', ')}</span>
          </div>
          <button
            type="button"
            className="wf-btn wf-btn-warn"
            onClick={() => handleLifecycle('repair', failedDeployments[0])}
            disabled={busy}
          >
            <Wrench size={14} /> Attempt Auto-Repair
          </button>
        </div>
      )}

      {/* Main Canvas + Details Panel */}
      <div className="wf-workspace">
        <div className="wf-canvas-card">
          <div className="wf-legend">
            <span className="wf-legend-item"><span className="wf-dot" style={{ background: '#16a34a' }} /> Active</span>
            <span className="wf-legend-item"><span className="wf-dot" style={{ background: '#d97706' }} /> Warning / Idle</span>
            <span className="wf-legend-item"><span className="wf-dot" style={{ background: '#dc2626' }} /> Failed</span>
            <span className="wf-legend-item"><span className="wf-dot" style={{ background: '#94a3b8' }} /> Inactive / Offline</span>
          </div>

          {deployments.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', background: '#fff', borderRadius: 10, border: '1px dashed #cbd5e1' }}>
              <Cpu size={28} style={{ opacity: 0.45, marginBottom: 8 }} />
              <div style={{ fontWeight: 700, color: '#0f172a' }}>No device-bound agents deployed yet</div>
              <p style={{ color: '#64748b', fontSize: '0.86rem', margin: '6px 0 14px' }}>
                Register an airport device and deploy any of the {models.length} existing AI models to visualize its workflow pipeline.
              </p>
              <button type="button" className="wf-btn wf-btn-primary" onClick={openCreateModal}>
                <Plus size={15} /> Create First Agent
              </button>
            </div>
          ) : (
            <div className="wf-pipeline-rows">
              {deployments.map((dep) => {
                const st = STATUS_STYLE[dep.status] || STATUS_STYLE.offline
                const conn = connections.find((c) => c.deployment_id === dep.deployment_id)
                const connState = conn?.state || 'inactive'
                const isSelected = dep.deployment_id === selectedId
                return (
                  <div key={dep.deployment_id} className="wf-row">
                    <div className="wf-endpoint-box">
                      <div className="wf-endpoint-tag">Input Source</div>
                      <div className="wf-endpoint-title">{dep.input_source || `Device #${dep.device_id ?? 'Host'}`}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 2 }}>
                        {dep.location || (dep.device_id != null ? `Device #${dep.device_id}` : 'Host')}
                      </div>
                    </div>

                    <DirectionalArrow state={connState} />

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedId(dep.deployment_id)}
                      onKeyDown={(e) => e.key === 'Enter' && setSelectedId(dep.deployment_id)}
                      className={`wf-node ${isSelected ? 'wf-node-selected' : ''} ${dep.status === 'failed' ? 'wf-node-failed' : ''} ${dep.status === 'offline' ? 'wf-node-offline' : ''}`}
                    >
                      <div className="wf-node-top">
                        <span className="wf-node-name">{dep.agent_name}</span>
                        <span className="wf-status-pill" style={{ background: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      </div>
                      <div className="wf-node-meta">
                        <span><strong>Model:</strong> {dep.model_name}</span>
                        <span><strong>Type:</strong> {dep.agent_type}</span>
                        <span>
                          <strong>Device:</strong>{' '}
                          {dep.device_id != null ? `#${dep.device_id} (${dep.device_label || 'Registered'})` : 'Host'}
                          {dep.location ? ` · ${dep.location}` : ''}
                        </span>
                        <span><strong>Processing:</strong> {dep.processing_status}</span>
                      </div>
                    </div>

                    <DirectionalArrow state={connState} />

                    <div className="wf-endpoint-box">
                      <div className="wf-endpoint-tag">Output Destination</div>
                      <div className="wf-endpoint-title">{dep.output_destination || 'Processing Output'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Core Runtime Agents discovered in AgentRegistry */}
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #cbd5e1' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 8 }}>
              CORE BACKEND ORCHESTRATOR AGENTS ({runtimeAgents.length})
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {runtimeAgents.map((ra) => {
                const st = STATUS_STYLE[ra.status] || STATUS_STYLE.offline
                return (
                  <div
                    key={ra.agent_id}
                    style={{
                      background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8,
                      padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <strong>{ra.name}</strong>
                    <span className="wf-status-pill" style={{ background: st.bg, color: st.text }}>{ra.status}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Agent Details & Controls Panel */}
        <aside className="wf-details-panel">
          <h2>Agent Details &amp; Controls</h2>
          {!selected ? (
            <p style={{ color: '#64748b', fontSize: '0.86rem' }}>
              Select an agent node on the workflow canvas to inspect its deployment and run lifecycle controls.
            </p>
          ) : (
            <>
              <div className="wf-kv">
                <div className="wf-kv-row"><span>Agent Name</span><strong>{selected.agent_name}</strong></div>
                <div className="wf-kv-row"><span>Deployment ID</span><strong>{selected.deployment_id}</strong></div>
                <div className="wf-kv-row"><span>AI Model</span><strong>{selected.model_name}</strong></div>
                <div className="wf-kv-row"><span>Agent Type</span><strong>{selected.agent_type}</strong></div>
                <div className="wf-kv-row">
                  <span>Assigned Device</span>
                  <strong>{selected.device_id != null ? `#${selected.device_id} (${selected.device_label || '—'})` : 'Host'}</strong>
                </div>
                <div className="wf-kv-row"><span>Location / Gate</span><strong>{selected.location || '—'}</strong></div>
                <div className="wf-kv-row"><span>Status</span><strong>{selected.status}</strong></div>
                <div className="wf-kv-row"><span>Processing</span><strong>{selected.processing_status}</strong></div>
                <div className="wf-kv-row"><span>Health Endpoint</span><strong>{selected.health_url || '—'}</strong></div>
              </div>

              {selected.last_error && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b',
                  padding: '8px 10px', borderRadius: 6, fontSize: '0.8rem', marginBottom: 12,
                }}>
                  <strong>Error:</strong> {selected.last_error}
                </div>
              )}

              <div className="wf-actions-grid">
                <button
                  type="button"
                  className="wf-btn wf-btn-warn"
                  disabled={busy || selected.status === 'stopped'}
                  onClick={() => handleLifecycle('stop', selected)}
                >
                  <Square size={14} /> Stop
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-ok"
                  disabled={busy}
                  onClick={() => handleLifecycle('restart', selected)}
                >
                  <Play size={14} /> Restart
                </button>
                <button
                  type="button"
                  className="wf-btn"
                  disabled={busy}
                  onClick={() => handleLifecycle('repair', selected)}
                >
                  <Wrench size={14} /> Repair
                </button>
                <button
                  type="button"
                  className="wf-btn"
                  disabled={busy || devices.length === 0}
                  onClick={() => {
                    setDupDeviceId(devices[0]?.equipment_id ? String(devices[0].equipment_id) : '')
                    setDupName(`${selected.agent_name} (Copy)`)
                    setShowDupModal(true)
                  }}
                >
                  <Copy size={14} /> Duplicate
                </button>
                <button
                  type="button"
                  className="wf-btn wf-btn-danger"
                  style={{ gridColumn: '1 / -1' }}
                  disabled={busy}
                  onClick={() => handleLifecycle('remove', selected)}
                >
                  <Trash2 size={14} /> Remove Agent Instance
                </button>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Create & Deploy Agent Modal */}
      {showCreate && (
        <div className="wf-modal-backdrop" role="dialog" aria-modal="true">
          <form className="wf-modal" onSubmit={handleCreateAgent}>
            <h3>Create &amp; Deploy AI Agent</h3>
            <div className="wf-field">
              <label>AI Model (Existing)</label>
              <select value={formModel} onChange={(e) => onModelChange(e.target.value)} required>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.health?.reachable ? 'Online' : 'Offline'})
                  </option>
                ))}
              </select>
            </div>
            <div className="wf-field">
              <label>Target Airport Device</label>
              <select value={formDevice} onChange={(e) => setFormDevice(e.target.value)}>
                <option value="">Host / Unassigned</option>
                {devices.map((d) => (
                  <option key={d.equipment_id} value={d.equipment_id}>
                    #{d.equipment_id} · {d.label} ({d.equipment_type}) — {d.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="wf-field">
              <label>Agent Name</label>
              <input value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </div>
            <div className="wf-field">
              <label>Gate / Location (optional)</label>
              <input value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="e.g. Gate B22" />
            </div>
            <div className="wf-field">
              <label>Input Source</label>
              <input value={formInput} onChange={(e) => setFormInput(e.target.value)} />
            </div>
            <div className="wf-field">
              <label>Output Destination</label>
              <input value={formOutput} onChange={(e) => setFormOutput(e.target.value)} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="wf-btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button type="submit" className="wf-btn wf-btn-primary" disabled={busy}>Deploy Agent</button>
            </div>
          </form>
        </div>
      )}

      {/* Register New Device Modal */}
      {showDeviceModal && (
        <div className="wf-modal-backdrop" role="dialog" aria-modal="true">
          <form className="wf-modal" onSubmit={handleRegisterDevice}>
            <h3>Register New Airport Device</h3>
            <div className="wf-field">
              <label>Device Label</label>
              <input value={devLabel} onChange={(e) => setDevLabel(e.target.value)} placeholder="e.g. Gate B22 Face Camera" required />
            </div>
            <div className="wf-field">
              <label>Device Type</label>
              <select value={devType} onChange={(e) => setDevType(e.target.value)}>
                <option value="camera">camera</option>
                <option value="kiosk">kiosk</option>
                <option value="security_gate">security_gate</option>
                <option value="boarding_gate">boarding_gate</option>
                <option value="xray">xray</option>
                <option value="sensor">sensor</option>
              </select>
            </div>
            <div className="wf-field">
              <label>Serial Number</label>
              <input value={devSerial} onChange={(e) => setDevSerial(e.target.value)} placeholder="e.g. CAM-B22-001" required />
            </div>
            <div className="wf-field">
              <label>Gate / Location</label>
              <input value={devLocation} onChange={(e) => setDevLocation(e.target.value)} placeholder="e.g. Terminal 1 · Gate B22" />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="wf-btn" onClick={() => setShowDeviceModal(false)}>Cancel</button>
              <button type="submit" className="wf-btn wf-btn-primary" disabled={busy}>Register Device</button>
            </div>
          </form>
        </div>
      )}

      {/* Duplicate / Redeploy Modal */}
      {showDupModal && selected && (
        <div className="wf-modal-backdrop" role="dialog" aria-modal="true">
          <form className="wf-modal" onSubmit={handleDuplicate}>
            <h3>Duplicate &amp; Deploy "{selected.agent_name}"</h3>
            <div className="wf-field">
              <label>Target Device</label>
              <select value={dupDeviceId} onChange={(e) => setDupDeviceId(e.target.value)} required>
                {devices.map((d) => (
                  <option key={d.equipment_id} value={d.equipment_id}>
                    #{d.equipment_id} · {d.label} ({d.equipment_type}) — {d.status}
                  </option>
                ))}
              </select>
            </div>
            <div className="wf-field">
              <label>New Agent Name</label>
              <input value={dupName} onChange={(e) => setDupName(e.target.value)} required />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button type="button" className="wf-btn" onClick={() => setShowDupModal(false)}>Cancel</button>
              <button type="submit" className="wf-btn wf-btn-primary" disabled={busy}>Deploy Copy</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
