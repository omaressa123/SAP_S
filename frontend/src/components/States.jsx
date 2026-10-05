import Card from './Card'
import AnimatedNumber from './animations/AnimatedNumber'
import AnimatedBars from './animations/AnimatedBars'
import { SkeletonSection } from './animations/Skeleton'

export function Loading({ label = 'Loading live airport data…' }) {
  return <SkeletonSection label={label} />
}

export function EmptyState({ title = 'No data available', hint }) {
  return (
    <Card title={title}>
      <p>No data available{hint ? ` — ${hint}` : '.'}</p>
    </Card>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="anim-error">
      <Card title="Connection issue">
        <p className="error">Unable to load airport data{error ? `: ${error}` : '.'}</p>
        {onRetry && <p><button className="btn" onClick={onRetry}>Retry</button></p>}
      </Card>
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
