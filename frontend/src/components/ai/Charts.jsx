import Card from '../Card'
import { EmptyState } from '../States'

/** Lightweight dependency-free SVG charts. All render REAL rows only. */

export function LineChart({ title, points = [], height = 120, formatY = (v) => v }) {
  if (!points.length) return <EmptyState title={title} hint="no time-series data returned by API" />
  const w = 560
  const h = height
  const pad = 8
  const max = Math.max(...points, 1)
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(pad + i * step).toFixed(1)},${(h - pad - (p / max) * (h - pad * 2)).toFixed(1)}`).join(' ')
  const area = `${d} L${(w - pad).toFixed(1)},${h - pad} L${pad},${h - pad} Z`
  return (
    <Card title={title}>
      <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg" role="img" aria-label={title}>
        <path d={area} className="chart-area" />
        <path d={d} className="chart-line" fill="none" />
        {points.map((p, i) => (
          <circle key={i} cx={pad + i * step} cy={h - pad - (p / max) * (h - pad * 2)} r="3" className="chart-dot" />
        ))}
      </svg>
      <div className="chart-meta"><span>max {formatY(max)}</span><span>{points.length} points</span></div>
    </Card>
  )
}

export function HBarList({ title, rows = [], valueKey = 'count', labelKey = 'label' }) {
  if (!rows.length) return <EmptyState title={title} hint="no rows returned by API" />
  const max = Math.max(...rows.map((r) => Number(r[valueKey]) || 0), 1)
  return (
    <Card title={title}>
      <div className="chart-hbars">
        {rows.map((r, i) => (
          <div key={i} className="chart-hbar-row">
            <span className="chart-hbar-label">{String(r[labelKey])}</span>
            <div className="chart-hbar-track">
              <div className="chart-hbar-fill" style={{ width: `${(Number(r[valueKey]) / max) * 100}%` }} />
            </div>
            <span className="chart-hbar-value">{Number(r[valueKey]).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function Donut({ title, segments = [] }) {
  const total = segments.reduce((a, s) => a + (Number(s.value) || 0), 0)
  if (!total) return <EmptyState title={title} hint="no distribution data returned by API" />
  const R = 54
  const C = 2 * Math.PI * R
  let acc = 0
  const palette = ['#071739', '#0e7c4a', '#c77b1a', '#d64550', '#4a5a75', '#8b93a7']
  return (
    <Card title={title}>
      <div className="chart-donut-wrap">
        <svg viewBox="0 0 140 140" className="chart-donut" role="img" aria-label={title}>
          <circle cx="70" cy="70" r={R} className="donut-bg" />
          {segments.map((s, i) => {
            const frac = (Number(s.value) || 0) / total
            const el = (
              <circle
                key={i} cx="70" cy="70" r={R} fill="none"
                stroke={palette[i % palette.length]} strokeWidth="16"
                strokeDasharray={`${(frac * C).toFixed(1)} ${C.toFixed(1)}`}
                strokeDashoffset={(-acc * C).toFixed(1)}
                transform="rotate(-90 70 70)"
              />
            )
            acc += frac
            return el
          })}
          <text x="70" y="66" textAnchor="middle" className="donut-total">{total.toLocaleString()}</text>
          <text x="70" y="82" textAnchor="middle" className="donut-caption">total</text>
        </svg>
        <ul className="donut-legend">
          {segments.map((s, i) => (
            <li key={i}>
              <span className="donut-swatch" style={{ background: palette[i % palette.length] }} />
              {s.label} — <strong>{Number(s.value).toLocaleString()}</strong> ({((Number(s.value) / total) * 100).toFixed(1)}%)
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

/** Histogram: binned distribution (wait times, confidence, weights). Bins come from buildHistogram(). */
export function Histogram({ title, bins = [], emptyHint = 'no distribution data returned by API' }) {
  if (!bins.length || !bins.some((b) => b.count > 0)) return <EmptyState title={title} hint={emptyHint} />
  const max = Math.max(...bins.map((b) => b.count), 1)
  return (
    <Card title={title}>
      <div className="hist" role="img" aria-label={title}>
        {bins.map((b, i) => (
          <div key={i} className="hist-col" title={`${b.label}: ${b.count}`}>
            <div className="hist-bar" style={{ height: `${Math.max(4, (b.count / max) * 110)}px` }} />
            <span className="hist-count">{b.count}</span>
            <span className="hist-label">{b.label}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
/** Zone heat grid: cells sized equally, intensity from value/max. */
export function ZoneHeat({ title, cells = [], emptyHint = 'no zone data returned by API' }) {
  if (!cells.length) return <EmptyState title={title} hint={emptyHint} />
  const max = Math.max(...cells.map((c) => Number(c.value) || 0), 1)
  return (
    <Card title={title}>
      <div className="zone-heat">
        {cells.map((c, i) => (
          <div key={i} className={`zone-cell sev-${c.severity || 'info'}`} style={{ '--heat': (Number(c.value) / max).toFixed(2) }} title={`${c.label}: ${c.value}`}>
            <strong>{c.label}</strong>
            <span>{Number(c.value).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
