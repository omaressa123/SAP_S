/**
 * Disruption Planner — review and approve LLM-assisted / heuristic recovery
 * proposals for airport disruptions (weather, runway closure, ground stop, …).
 *
 * Data source:
 *   GET    /api/v1/agents/disruption/plans        (list)
 *   GET    /api/v1/agents/disruption/plan/{id}    (detail)
 *   POST   /api/v1/agents/disruption/plan/{id}/approve   (staff/admin)
 *   POST   /api/v1/agents/disruption/plan/{id}/execute   (staff/admin)
 *   POST   /api/v1/agents/disruption/plan/{id}/reject    (staff/admin)
 *
 * Generation, validation, approval and execution are separate. A proposal is
 * only executed after explicit human approval.
 */
import { useCallback, useState } from 'react'
import { Play, RefreshCw, ShieldAlert, Clock, UserCheck, XCircle } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { DisruptionApi } from '../services/api'
import { Loading, ErrorState } from '../components/States'
import PulseDot from '../components/animations/PulseDot'
import FadeIn from '../components/animations/FadeIn'

const STATUS_LABEL = {
  proposed: 'Proposed',
  validated: 'Validated',
  approved: 'Approved',
  rejected: 'Rejected',
  executed: 'Executed',
  failed: 'Failed',
}

const STATUS_COLOR = {
  proposed: '#c77b1a',
  validated: '#e2a13a',
  approved: '#0e7c4a',
  rejected: '#d64550',
  executed: '#1a5f7a',
  failed: '#8b93a7',
}

export default function DisruptionPlanner() {
  const [nonce, setNonce] = useState(0)
  const retry = useCallback(() => setNonce((n) => n + 1), [])
  const [selectedPlan, setSelectedPlan] = useState(null)

  const plans = useApi('/api/v1/agents/disruption/plans', [nonce])

  if (plans.loading) {
    return (
      <div className="ops-bg">
        <h1>Disruption Planner</h1>
        <Loading />
      </div>
    )
  }
  if (plans.error) {
    return (
      <div className="ops-bg">
        <h1>Disruption Planner</h1>
        <ErrorState error={plans.error} onRetry={retry} />
      </div>
    )
  }

  const rows = plans.data || []

  return (
    <div className="ops-bg">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <h1>Disruption Planner</h1>
        <button className="btn" onClick={retry}>
          <RefreshCw size={16} /> Refresh
        </button>
        <button className="btn accent" onClick={createPlan}>
          <Play size={16} /> Generate Proposal
        </button>
      </div>

      <div className="dash-grid-2">
        <FadeIn delay={0}>
          <Card className="lift" title="Recovery Proposals">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {rows.length === 0 ? (
                <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '12px' }}>
                  No disruption recovery proposals yet.
                </p>
              ) : (
                rows.map((p) => (
                  <div
                    key={p.proposal_id}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px',
                      background: '#f6f8fc', borderRadius: 8, cursor: 'pointer',
                      onClick: () => setSelectedPlan(p.proposal_id) }}
                  >
                    <PulseDot status={p.status} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, color: '#071739', fontSize: '0.85rem' }}>
                        {p.scenario_type} &mdash; {p.severity}
                      </div>
                      <div style={{ color: '#4a5a75', fontSize: '0.75rem' }}>{p.root_cause}</div>
                    </div>
                    <span style={{ color: STATUS_COLOR[p.status] || '#4a5a75', fontWeight: 600, fontSize: '0.75rem' }}>
                      {STATUS_LABEL[p.status] || p.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={200}>
          <Card className="lift" title={selectedPlan ? `Proposal: ${selectedPlan}` : 'Select a proposal'}>
            {selectedPlan ? (
              <PlanDetail planId={selectedPlan} nonce={nonce} />
            ) : (
              <p style={{ color: '#4a5a75', fontSize: '0.85rem', padding: '24px', textAlign: 'center' }}>
                Select a proposal to view its snapshot, validation result, and approval status.
              </p>
            )}
          </Card>
        </FadeIn>
      </div>
    </div>
  )

  function createPlan() {
    const scenarioType = window.prompt('Scenario type (weather / runway_closure / ground_stop)', 'weather')
    if (!scenarioType) return
    const severity = window.prompt('Severity (low / medium / high / critical)', 'medium')
    if (!severity) return
    const rootCause = window.prompt('Root cause description', 'Operational disruption')
    if (!rootCause) return
    const nonce2 = setNonce((n) => n + 1)
    DisruptionApi.createPlan({
      scenario_id: `manual-${Date.now()}`,
      scenario_type: scenarioType,
      severity,
      root_cause: rootCause,
      created_by: 'operator',
    }).then(() => setNonce(nonce2 + 1)).catch((e) => alert('Failed to create proposal: ' + e.message))
  }
}

function PlanDetail({ planId, nonce }) {
  const plan = useApi(`/api/v1/agents/disruption/plan/${planId}`, [nonce, planId])

  if (plan.error) return <ErrorState error={plan.error} />
  const p = plan.data || {}

  const statusReadonly = p.status !== 'validated' && p.status !== 'proposed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, color: '#071739', fontSize: '1.1rem' }}>
            Disruption Recovery Proposal
          </div>
          <div style={{ color: '#4a5a75', fontSize: '0.85rem' }}>{p.scenario_id}</div>
        </div>
        <PulseDot status={p.status} label={p.status} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginTop: 10 }}>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginBottom: 4 }}>Scenario</div>
          <div style={{ fontWeight: 700 }}>{p.scenario_type}</div>
        </div>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginBottom: 4 }}>Severity</div>
          <div style={{ fontWeight: 700 }}>{p.severity}</div>
        </div>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginBottom: 4 }}>Status</div>
          <div style={{ fontWeight: 700, color: STATUS_COLOR[p.status] || '#4a5a75' }}>
            {STATUS_LABEL[p.status] || p.status}
          </div>
        </div>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ color: '#4a5a75', fontSize: '0.75rem', marginBottom: 4 }}>Actions</div>
          <div style={{ fontWeight: 700 }}>{(p.actions || []).length}</div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 12 }}>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontWeight: 600, color: '#071739', marginBottom: 6 }}>Validation</div>
          <div style={{ fontSize: '0.8rem' }}>
            {p.validation_result && p.validation_result.passed ? (
              <span style={{ color: '#0e7c4a', fontWeight: 600 }}>PASSED</span>
            ) : (
              <span style={{ color: '#d64550', fontWeight: 600 }}>REJECTED</span>
            )}
          </div>
          <div style={{ fontSize: '0.78rem', marginTop: 4, color: '#4a5a75' }}>
            {(p.validation_result && p.validation_result.violations || []).length} violation(s)
          </div>
        </div>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontWeight: 600, color: '#071739', marginBottom: 6 }}>Root Cause</div>
          <div style={{ fontSize: '0.8rem', color: '#4a5a75' }}>{p.root_cause || '—'}</div>
        </div>
        <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontWeight: 600, color: '#071739', marginBottom: 6 }}>Created</div>
          <div style={{ fontSize: '0.8rem', color: '#4a5a75' }}>{p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</div>
        </div>
        {p.approved_at && (
          <div style={{ background: '#f6f8fc', borderRadius: 8, padding: '12px' }}>
            <div style={{ fontWeight: 600, color: '#071739', marginBottom: 6 }}>Approved</div>
            <div style={{ fontSize: '0.8rem', color: '#4a5a75' }}>{new Date(p.approved_at).toLocaleString()}</div>
          </div>
        )}
      </div>

      {p.error_message && (
        <div style={{ marginTop: 12, background: '#fdecea', borderRadius: 8, padding: '12px', color: '#d64550', fontSize: '0.8rem' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
          {p.error_message}
        </div>
      )}

      <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {p.status === 'validated' && !statusReadonly && (
          <>
            <button className="btn accent" onClick={() => handleDecision('approve')}>
              <UserCheck size={16} /> Approve
            </button>
            <button className="btn" onClick={() => handleDecision('reject')}>
              <XCircle size={16} /> Reject
            </button>
          </>
        )}
        {p.status === 'approved' && (
          <button className="btn accent" onClick={executePlan}>
            <Play size={16} /> Execute Plan
          </button>
        )}
        {p.status === 'executed' && (
          <span style={{ color: '#0e7c4a', fontWeight: 600, fontSize: '0.85rem' }}>
            Executed &mdash; recovery actions dispatched to agents.
          </span>
        )}
        {p.status === 'failed' && (
          <span style={{ color: '#d64550', fontWeight: 600, fontSize: '0.85rem' }}>
            Execution failed &mdash; see error details above.
          </span>
        )}
      </div>

      {(p.validation_result && p.validation_result.violations || []).length > 0 && (
        <div style={{ marginTop: 12, background: '#fdecea', borderRadius: 8, padding: '12px' }}>
          <div style={{ fontWeight: 600, color: '#d64550', marginBottom: 6 }}>Validation Violations</div>
          <ul style={{ fontSize: '0.8rem', color: '#4a5a75', margin: 0, paddingLeft: 18 }}>
            {(p.validation_result.violations || []).map((v, i) => (
              <li key={i}>{v}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )

  async function handleDecision(decision) {
    const reason = window.prompt(`Reason for ${decision}:`, '')
    if (reason === null) return
    try {
      if (decision === 'approve') {
        await DisruptionApi.approvePlan(planId, reason || 'Approved by operator')
      } else {
        await DisruptionApi.rejectPlan(planId, reason || 'Rejected by operator')
      }
      setNonce((n) => n + 1)
      setSelectedPlan(planId)
    } catch (e) {
      alert('Failed to record decision: ' + e.message)
    }
  }

  async function executePlan() {
    if (!window.confirm('Execute this recovery plan? Actions will be dispatched to the registered agents.')) return
    try {
      await DisruptionApi.executePlan(planId)
      setNonce((n) => n + 1)
      setSelectedPlan(planId)
    } catch (e) {
      alert('Failed to execute plan: ' + e.message)
    }
  }
}
