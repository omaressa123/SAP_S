import Card from './Card'
import AnimatedNumber from './animations/AnimatedNumber'
import AnimatedBars from './animations/AnimatedBars'
import { SkeletonSection } from './animations/Skeleton'

export function Loading({ label = 'Loading live airport data…' }) {
  return <SkeletonSection label={label} />
}

export function EmptyState({ title = 'No data available', hint, icon = '📭', action }) {
  return (
    <Card title={title}>
      <div className="state-illust" aria-hidden>{icon}</div>
      <p>No data available{hint ? ` — ${hint}` : '.'}</p>
      {action && <p style={{ marginTop: 8 }}>{action}</p>}
    </Card>
  )
}

export function ErrorState({ error, onRetry }) {
  const msg = typeof error === 'string' ? error : error?.message || ''
  // Never dump stacks/JSON: show only the first human-readable line.
  const clean = msg.split('\n')[0].slice(0, 220)
  return (
    <div className="anim-error" role="alert">
      <Card title="⚠ Service unavailable">
        <p><strong>AI MODULE UNAVAILABLE</strong> — unable to connect to the service{clean ? `: ${clean}` : '.'}</p>
        {onRetry && <p style={{ marginTop: 8 }}><button className="btn" onClick={onRetry}>Retry</button></p>}
      </Card>
    </div>
  )
}

/** Animated processing indicator for in-flight AI work. Render ONLY while busy. */
export function AIProcessingIndicator({ label = 'AI MODEL PROCESSING', detail = 'Analyzing — this usually takes a few seconds…' }) {
  return (
    <div className="ai-processing" role="status" aria-label={label}>
      <strong>{label}</strong>
      <span className="ai-proc-dots" aria-hidden><i /><i /><i /></span>
      <span className="ai-muted">{detail}</span>
    </div>
  )
}

export function StatCard({ label, value, sub, decimals = 0, suffix = '' }) {
  return (
    <Card title={label}>
      <div style={{ fontSize: '2rem', fontWeight: 800 }}>
        <AnimatedNumber value={typeof value === 'number' ? value : NaN} decimals={decimals} suffix={suffix} />
      </div>
      {sub && <div style={{ color: '#4a5a75' }}>{sub}</div>}
    </Card>
  )
}

/** Honest bar chart: renders real API rows only; empty -> empty state. */
export function BarChart({ title, rows = [], labelKey = 'label', valueKey = 'count' }) {
  if (!rows.length) return <EmptyState title={title} hint="no rows returned by API" />
  return (
    <Card title={title}>
      <AnimatedBars rows={rows} labelKey={labelKey} valueKey={valueKey} />
    </Card>
  )
}
