import Card from '../Card'

export function SkeletonCard({ lines = 3 }) {
  return (
    <Card title={<span className="skeleton" style={{ display: 'block', width: '40%' }}>&nbsp;</span>}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton" style={{ marginTop: 8, width: `${92 - i * 14}%` }}>&nbsp;</div>
      ))}
    </Card>
  )
}

export function SkeletonChart() {
  return (
    <Card title={<span className="skeleton" style={{ display: 'block', width: '35%' }}>&nbsp;</span>}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, marginTop: 8 }}>
        {[70, 45, 90, 60, 80, 50].map((h, i) => (
          <div key={i} className="skeleton" style={{ flex: 1, minHeight: h }} />
        ))}
      </div>
    </Card>
  )
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <Card title={<span className="skeleton" style={{ display: 'block', width: '30%' }}>&nbsp;</span>}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ marginTop: 8 }}>&nbsp;</div>
      ))}
    </Card>
  )
}

export function SkeletonSection() {
  return (
    <div role="status" aria-label="Loading airport data">
      <div className="dash-grid">
        {[0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} lines={2} />)}
      </div>
      <div className="dash-grid-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </div>
  )
}
