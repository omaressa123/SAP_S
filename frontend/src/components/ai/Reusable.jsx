/* §30 named reusable components — thin wrappers over AiVisuals/Charts/States.
   No duplicated logic: every component delegates to the shared primitives. */
import Card from '../Card'
import { StatCard, AIProcessingIndicator as Proc, EmptyState } from '../States'
import { StatusBadge, ConfidenceBar, KvGrid, EventTimeline as TL, ResultCard } from './AiVisuals'
import { HBarList, Donut, LineChart, ZoneHeat, Histogram } from './Charts'

export { Proc as AIProcessingIndicator }
export { Histogram as ReportHistogram }
export { ZoneHeat as ReportHeatmap }
export { TL as AIEventTimeline }

export function AIStatusCard({ label = 'AI status', status = 'online', detail }) {
  const tone = /online|clear|safe|verified|granted|open/i.test(status) ? 'good'
    : /warn|review|flag|progress|scan/i.test(status) ? 'warn'
    : /fail|denied|critical|threat|offline|unavail/i.test(status) ? 'bad' : 'idle'
  return (
    <Card title={label}>
      <p><StatusBadge tone={tone}>{status.toUpperCase()}</StatusBadge></p>
      {detail && <p className="ai-muted">{detail}</p>}
    </Card>
  )
}

export function AIConfidenceCard({ label = 'AI confidence', value }) {
  return (
    <Card title={label}>
      <ConfidenceBar value={value} label={label} />
    </Card>
  )
}

export function AIAlertCard({ severity = 'info', title, detail, time }) {
  const tone = /critical|high|threat|fire|fall/i.test(severity) ? 'bad'
    : /medium|warning|review/i.test(severity) ? 'warn' : 'good'
  const icon = tone === 'bad' ? '🔴' : tone === 'warn' ? '🟡' : '🟢'
  return (
    <Card className={`ai-result ${tone}`} title={undefined}>
      <p><span aria-hidden>{icon}</span> <StatusBadge tone={tone}>{`${severity.toUpperCase()} — ${title}`}</StatusBadge></p>
      {detail && <p className="ai-muted">{detail}</p>}
      {time && <p className="ai-tl-time">{time}</p>}
    </Card>
  )
}

export function KPIGrid({ items = [] }) {
  if (!items.length) return <EmptyState title="Key metrics" hint="no metrics returned by API" />
  return (
    <div className="dash-grid">
      {items.map((k) => (
        <StatCard key={k.label} label={k.label} value={k.value} sub={k.sub} decimals={k.decimals || 0} suffix={k.suffix || ''} />
      ))}
    </div>
  )
}

export function ReportChart({ kind, ...props }) {
  if (kind === 'line') return <LineChart {...props} />
  if (kind === 'donut') return <Donut {...props} />
  return <HBarList {...props} />
}

export function ReportSummary({ insights = [] }) {
  return (
    <Card title="AI insights — generated from live data">
      {!insights.length
        ? <p className="ai-muted">Not enough data to generate insights yet.</p>
        : <ul className="ai-insights">{insights.map((s, i) => <li key={i}>💡 {s}</li>)}</ul>}
    </Card>
  )
}

/* ---------------- 3D scene components (CSS 3D, lightweight, reusable) ---------------- */

export function ThreeDPassportScanner({ scanning = false, detected = false }) {
  return (
    <div>
      <div className="passport-stage" aria-hidden>
        <div className={`passport-3d${scanning ? ' scanning' : ''}`}>
          <div className="passport-cover">
            <div className="pp-emblem">✈</div>
            <div><strong>PASSPORT</strong><br />Smart Airport · eMRTD</div>
            <div className="pp-lines"><i /><i /><i /></div>
            <div className="pp-beam" />
          </div>
        </div>
      </div>
      <div className="pp-state-row">
        <StatusBadge tone={detected ? 'good' : scanning ? 'live' : 'idle'}>
          {detected ? 'PASSPORT DETECTED' : scanning ? 'SCANNING…' : 'IDLE — PLACE DOCUMENT'}
        </StatusBadge>
      </div>
    </div>
  )
}

export function ThreeDFaceScanner({ scanning = false, similarity = null, verdict = null }) {
  const cls = verdict === 'verified' ? ' verified' : verdict === 'failed' ? ' failed' : ''
  return (
    <div>
      <div className={`face-stage${cls}`} aria-hidden>
        <div className="face-frame">
          <div className="face-oval" />
          <div className="face-landmarks">
            <i style={{ left: '38%', top: '38%' }} /><i style={{ left: '58%', top: '38%' }} />
            <i style={{ left: '48%', top: '52%' }} /><i style={{ left: '38%', top: '64%' }} />
            <i style={{ left: '58%', top: '64%' }} />
          </div>
          {scanning && <div className="face-scanline" />}
        </div>
        <div className="face-pct">{similarity === null ? '—' : `${(Number(similarity) * 100).toFixed(1)}%`}</div>
      </div>
      <ConfidenceBar value={similarity} label="Model similarity" />
    </div>
  )
}

export function ThreeDAirportGate({ state = 'closed', label }) {
  const cls = state === 'open' ? ' open' : state === 'denied' ? ' denied' : ''
  const text = label || (state === 'open' ? 'ACCESS GRANTED — GATE OPEN' : state === 'denied' ? 'ACCESS DENIED' : 'GATE CLOSED — AWAITING VERIFICATION')
  const tone = state === 'open' ? 'good' : state === 'denied' ? 'bad' : state === 'verifying' ? 'live' : 'idle'
  return (
    <div>
      <div className={`gate-stage${cls}`} aria-hidden>
        <div className="gate-post" />
        <div className="gate-door left" />
        <div className="gate-person">🧑‍✈️</div>
        <div className="gate-door right" />
        <div className="gate-post" />
      </div>
      <div className="pp-state-row"><StatusBadge tone={tone}>{text}</StatusBadge></div>
    </div>
  )
}

const BAG_EMOJI = ['🧳', '🎒', '💼', '🧷']
export function ThreeDBaggageConveyor({ bags = [], selectedId = null, onSelect }) {
  const items = bags.length ? bags.slice(0, 4) : [{ id: 'idle', label: 'Awaiting bag', cls: '' }]
  return (
    <div className="conveyor-stage">
      <div className="conveyor-belt" aria-hidden>
        <div className="scanner-arch" />
        {items.map((b, i) => (
          <button
            key={`${b.id}-${i}`} type="button"
            className={`conveyor-bag ${b.cls || ''}`}
            style={{ animationDelay: `${i * 1.8}s` }}
            onClick={() => onSelect?.(String(b.id))}
            title={b.label} aria-label={`Inspect ${b.label}`}
          >{BAG_EMOJI[i % BAG_EMOJI.length]}</button>
        ))}
      </div>
      {bags.length > 0 && (
        <div className="bag-grid">
          {bags.slice(0, 6).map((b) => (
            <button
              key={b.id} type="button"
              className={`bag-chip${String(selectedId) === String(b.id) ? ' selected' : ''}`}
              onClick={() => onSelect?.(String(b.id))}
            >{b.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ThreatDetectionViewer({ detections = [], scanning = false, emptyLabel = 'CLEAR — NO THREAT' }) {
  return (
    <div className="xray-stage">
      {scanning && <div className="xray-scan" aria-hidden />}
      <div style={{ fontSize: '4rem', textAlign: 'center', opacity: 0.9 }} aria-hidden>🧳</div>
      {detections.map((b, i) => (
        <div key={i} className={`xray-bbox ${b.cls || 'threat'}`} style={{ left: b.left, top: b.top, width: b.width, height: b.height }}>
          <span className="xray-tag">{b.label}{b.confidence != null ? ` · ${b.confidence}%` : ''}</span>
        </div>
      ))}
      {!detections.length && !scanning && (
        <div className="xray-bbox clear" style={{ left: '30%', top: '26%', width: '40%', height: '48%' }}>
          <span className="xray-tag">{emptyLabel}</span>
        </div>
      )}
    </div>
  )
}

export function PassengerFlowVisualization({ entering = 0, leaving = 0, peak = 0 }) {
  const occupancy = Math.max(0, entering - leaving)
  const max = Math.max(entering, leaving, peak, 1)
  return (
    <Card title="Passenger flow — live totals">
      <div className="flow-grid">
        <div className="flow-stat"><span className="flow-arrow" aria-hidden>➡️</span><strong>{Number(entering).toLocaleString()}</strong><span>entering</span></div>
        <div className="flow-stat"><span className="flow-arrow" aria-hidden>⬅️</span><strong>{Number(leaving).toLocaleString()}</strong><span>leaving</span></div>
        <div className="flow-stat"><span className="flow-arrow" aria-hidden>🧍</span><strong>{occupancy.toLocaleString()}</strong><span>in terminal</span></div>
      </div>
      <div className="flow-bars" role="img" aria-label={`Entering ${entering}, leaving ${leaving}, peak ${peak}`}>
        {[['Entering', entering, 'good'], ['Leaving', leaving, ''], ['Peak', peak, 'warn']].map(([l, v, c]) => (
          <div key={l} className="chart-hbar-row">
            <span className="chart-hbar-label">{l}</span>
            <div className="chart-hbar-track"><div className={`chart-hbar-fill flow-${c}`} style={{ width: `${(v / max) * 100}%` }} /></div>
            <span className="chart-hbar-value">{Number(v).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function ReportFilters({ tab, value, onChange }) {
  const v = value || {}
  const set = (patch) => onChange({ ...v, ...patch })
  return (
    <div className="report-filters">
      {tab === 'passengers' && (
        <div className="pp-state-row" role="group" aria-label="Date range">
          {['all', 'today', 'yesterday', 'last7', 'last30', 'custom'].map((p) => (
            <button key={p} type="button" className="btn" style={(v.preset || 'all') === p ? {} : { opacity: 0.55 }} onClick={() => set({ preset: p })}>{p}</button>
          ))}
          {v.preset === 'custom' && (
            <span className="filter-custom">
              <label>From <input type="date" value={v.from || ''} onChange={(e) => set({ from: e.target.value })} /></label>
              <label>To <input type="date" value={v.to || ''} onChange={(e) => set({ to: e.target.value })} /></label>
            </span>
          )}
        </div>
      )}
      {tab === 'flights' && (
        <p><label>Status filter:{' '}
          <input value={v.status || ''} onChange={(e) => set({ status: e.target.value })} placeholder="scheduled / boarding / departed / delayed / cancelled" style={{ width: 340 }} />
        </label></p>
      )}
      {tab === 'baggage' && (
        <p><label>Status filter:{' '}
          <input value={v.status || ''} onChange={(e) => set({ status: e.target.value })} placeholder="e.g. loaded / moving / delivered" style={{ width: 300 }} />
        </label></p>
      )}
      {['security', 'ai', 'iot', 'operations'].includes(tab) && (
        <p className="ai-muted">Live snapshot — this endpoint exposes no server-side filters, so none are offered.</p>
      )}
    </div>
  )
}

export { KvGrid, ResultCard, StatusBadge, ConfidenceBar }
