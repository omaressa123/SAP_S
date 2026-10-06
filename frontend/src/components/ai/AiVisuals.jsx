import PulseDot from '../animations/PulseDot'
import Card from '../Card'

/** Consistent AI module page shell: header + live status strip + content sections. */
export function AiModuleLayout({ icon, title, description, aiStatus = 'online', systemNote, stats = [], children }) {
  return (
    <>
      <div className="ai-hero">
        <div className="ai-hero-icon">{icon}</div>
        <div>
          <h1 style={{ marginBottom: 4 }}>{title}</h1>
          <p className="ai-hero-sub">{description}</p>
        </div>
        <div className="ai-hero-status">
          <PulseDot status={aiStatus === 'online' ? 'online' : aiStatus} label={aiStatus === 'online' ? 'AI Model Online' : aiStatus} />
          {systemNote && <span className="ai-hero-note">{systemNote}</span>}
        </div>
      </div>
      {stats.length > 0 && (
        <div className="ai-stat-strip">
          {stats.map((s) => (
            <div key={s.label} className="ai-stat">
              <span className="ai-stat-label">{s.label}</span>
              <span className="ai-stat-value">{s.value}</span>
              {s.sub && <span className="ai-stat-sub">{s.sub}</span>}
            </div>
          ))}
        </div>
      )}
      {children}
    </>
  )
}

export function StatusBadge({ tone = 'idle', children }) {
  return <span className={`ai-badge tone-${tone}`}>{children}</span>
}

/** Horizontal AI pipeline: stages with done / active / idle / fail states. */
export function Pipeline({ stages = [], activeIndex = -1, failedIndex = -1 }) {
  return (
    <div className="ai-pipeline" role="list" aria-label="AI processing pipeline">
      {stages.map((s, i) => {
        const state = i === failedIndex ? 'fail' : i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'idle'
        return (
          <div key={s} role="listitem" className={`ai-pipe-step ${state}`}>
            <span className="ai-pipe-dot" />
            <span className="ai-pipe-label">{s}</span>
            {i < stages.length - 1 && <span className="ai-pipe-link" />}
          </div>
        )
      })}
    </div>
  )
}

/** 0-100 confidence / similarity bar. Value is a real number or null (unknown). */
export function ConfidenceBar({ value, label = 'Confidence' }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return (
      <div className="ai-conf">
        <span className="ai-conf-label">{label}: —</span>
        <div className="ai-conf-track"><div className="ai-conf-fill unknown" style={{ width: '100%' }} /></div>
      </div>
    )
  }
  const pct = Math.max(0, Math.min(100, Number(value) <= 1 ? Number(value) * 100 : Number(value)))
  const tone = pct >= 80 ? 'good' : pct >= 55 ? 'warn' : 'bad'
  return (
    <div className="ai-conf">
      <span className="ai-conf-label">{label}: {pct.toFixed(1)}%</span>
      <div className="ai-conf-track"><div className={`ai-conf-fill ${tone}`} style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

export function KvGrid({ items = [] }) {
  return (
    <dl className="ai-kv">
      {items.map((it) => (
        <div key={it.k} className="ai-kv-row">
          <dt>{it.k}</dt>
          <dd>{it.v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

export function EventTimeline({ events = [], emptyHint = 'No events recorded yet.' }) {
  if (!events.length) return <p className="ai-muted">{emptyHint}</p>
  return (
    <ol className="ai-timeline">
      {events.map((e, i) => (
        <li key={i} className={`ai-tl-item sev-${e.severity || 'info'}`}>
          <span className="ai-tl-dot" />
          <div>
            <strong>{e.title}</strong>
            {e.detail && <div className="ai-muted">{e.detail}</div>}
            {e.time && <div className="ai-tl-time">{e.time}</div>}
          </div>
          {e.badge && <StatusBadge tone={e.tone || 'idle'}>{e.badge}</StatusBadge>}
        </li>
      ))}
    </ol>
  )
}

export function ResultCard({ tone = 'idle', title, children }) {
  return (
    <Card className={`ai-result ${tone}`}>
      <div className="ai-result-head">
        <StatusBadge tone={tone}>{title}</StatusBadge>
      </div>
      {children}
    </Card>
  )
}
