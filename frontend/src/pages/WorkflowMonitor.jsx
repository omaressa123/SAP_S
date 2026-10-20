/**
 * Workflow Monitor — view agent workflow executions with per-step task
 * details, retry counts, errors, correlation IDs, and NEEDS_REVIEW states.
 *
 * Data source: GET /api/v1/agents/workflows (list) and
 * GET /api/v1/agents/workflows/{id} (detail).
 */
import { useCallback, useState } from 'react'
import { Activity, ShieldAlert, Clock, RefreshCw } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import PulseDot from '../components/animations/PulseDot'

const STATUS_LABEL = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const STATUS_COLOR = {
  running: '#c77b1a',
  completed: '#0e7c4a',
  failed: '#d64550',
  cancelled: '#8b93a7',
}

const TASK_STATUS_LABEL = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  needs_review: 'Needs Review',
}

const TASK_STATUS_COLOR = {
  needs_review: '#c77b1a',
  completed: '#0e7c4a',
  failed: '#d64550',
  running: '#c77b1a',
  pending: '#4a5a75',
  cancelled: '#8b93a7',
}

export default function WorkflowMonitor() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])
  const [selectedWorkflow, setSelectedWorkflow] = useState(null)

  const workflows = useApi('/api/v1/agents/workflows?limit=50', [nonce])

  if (workflows.loading) {
    return (
      <div className="ops-bg">
        <h1>Workflow Monitor</h1>
        <Loading />
      </div>
    )
  }
  if (workflows.error) {
    return (
      <div className="ops-bg">
        <h1>Workflow Monitor</h1>
        <ErrorState error={workflows.error} onRetry={retry} />
      </div>
    )
  }

  const wfs = workflows.data || []

  return (
    <div className="ops-bg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1>Workflow Monitor</h1>
        <button className="btn" onClick={retry}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="dash-grid-2">
        <FadeIn delay={0}>
          <Card className="lift" title="Workflow Executions">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {wfs.length === 0 ? (
                <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '12px' }}>No workflow executions yet.</p>
              ) : (
                wfs.map((w) => (
                  <div
                    key={w.workflow_id}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px', background: '#f6f8fc', borderRadius: 8, cursor: 'pointer', onClick: () => setSelectedWorkflow(w.workflow_id) }}
                  >
                    <PulseDot status={w.status} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.85rem' }}>{w.name.replace(/_/g, ' ')}</div>
                      <div style={{ color: '#4a5a75', fontSize: '0.75rem' }}>{w.correlation_id}</div>
                    </div>
                    <span style={{ color: STATUS_COLOR[w.status] || '#4a5a75', fontWeight: 600, fontSize: '0.75rem' }}>{STATUS_LABEL[w.status] || w.status}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={200}>
          <Card className="lift" title={selectedWorkflow ? `Workflow: ${selectedWorkflow}` : 'Select a workflow'}>
            {selectedWorkflow ? (
              <WorkflowDetail workflowId={selectedWorkflow} nonce={nonce} />
            ) : (
              <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '24px', textAlign: 'center' }}>Select a workflow to view step details, retries, errors, and review status.</p>
            )}
          </Card>
        </FadeIn>
      </div>
    </div>
  )
}

function WorkflowDetail({ workflowId, nonce }) {
  const workflow = useApi(`/api/v1/agents/workflows/${workflowId}`, [nonce, workflowId])

  if (workflow.error) return <ErrorState error={workflow.error} />

  const wf = workflow.data || {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#071739', fontSize: '1.1rem' }}>{wf.name.replace(/_/g, ' ')}</div>
          <div style={{ color: '#4a5a75', fontSize: '0.85rem' }}>{wf.correlation_id}</div>
        </div>
        <PulseDot status={wf.status} label={wf.status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 10 }}>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginBottom: 4 }}>{wf.status}</div>
          <div style={{ fontWeight: 700, color: STATUS_COLOR[wf.status] || '#4a5a75' }}>{STATUS_LABEL[wf.status] || wf.status}</div>
        </div>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginBottom: 4 }}>{wf.steps_completed ? JSON.parse(wf.steps_completed).length : 0} steps</div>
          <div style={{ fontWeight: 700 }}>{wf.steps_completed ? JSON.parse(wf.steps_completed).length : 0}</div>
        </div>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginBottom: 4 }}>{wf.error_message ? 'Error' : '—'}</div>
          <div style={{ color: wf.error_message ? '#d64550' : '#0e7c4a', fontWeight: 600 }}>{wf.error_message || 'No errors'}</div>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 600, color: '#071739', marginBottom: 8 }}>Steps</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {JSON.parse(wf.steps_completed || '[]').map((taskId, i) => (
            <div key={taskId} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#ffffff', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.85rem' }}>
              <span style={{ flex: 0.15 }}>{i + 1}</span>
              <span style={{ flex: 0.2, fontWeight: 600 }}>{taskId}</span>
              <span style={{ flex: 0.2, color: TASK_STATUS_COLOR[wf.status] || '#4a5a75', fontWeight: 600 }}>{STATUS_LABEL[wf.status] || wf.status}</span>
              <span style={{ flex: 0.35, fontSize: '0.75rem', color: '#4a5a75' }}>{wf.created_at ? new Date(wf.created_at).toLocaleString() : '—'}</span>
            </div>
          ))}
        </div>
        {wf.output_payload && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontWeight: 600, color: '#071739', marginBottom: 8 }}>Output</div>
            <pre style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px', fontSize: '0.75rem', overflowX: 'auto' }}>{JSON.stringify(JSON.parse(wf.output_payload), null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  )
}

import { Loading, EmptyState, ErrorState } from '../components/States'
import FadeIn from '../components/animations/FadeIn'