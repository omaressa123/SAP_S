/* Data transformation layer: API response -> normalized viz-ready data.
   Single source for all report/AI adapters — no duplicate logic across pages.
   Every builder tolerates missing/empty payloads and never invents values. */

export function countBy(rows = [], key) {
  const m = new Map()
  for (const r of rows || []) {
    const k = r?.[key] ?? 'unknown'
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].map(([label, count]) => ({ label: String(label), count }))
}

/** { data } envelope-agnostic: backend wraps in {status, data}, useApi unwraps already. */
export function normalizeReportData(raw) {
  return raw && typeof raw === 'object' ? raw : {}
}

export function buildChartData(pairs = [], labelKey = 'label', valueKey = 'count') {
  return (pairs || []).map((r) => ({
    label: String(r?.[labelKey] ?? 'unknown'),
    count: Number(r?.[valueKey]) || 0,
  }))
}

export function buildKPIData(entries = []) {
  return entries.map(([label, value, opts = {}]) => ({ label, value: value ?? 0, ...opts }))
}

export function buildTimelineData(events = []) {
  return (events || []).map((e) => ({ ...e }))
}

/** Bucket numeric values into N histogram bins over [min,max]. Returns [{label, count}]. */
export function buildHistogram(values = [], bins = 10, min = 0, max = 1) {
  const nums = values.map(Number).filter(Number.isFinite)
  const edges = Array.from({ length: bins + 1 }, (_, i) => min + ((max - min) * i) / bins)
  const counts = new Array(bins).fill(0)
  for (const v of nums) {
    const c = Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / (max - min)) * bins)))
    counts[c] += 1
  }
  const width = (max - min) / bins
  return edges.slice(0, bins).map((e, i) => ({
    label: `${fmtN(e)}–${fmtN(e + width)}`,
    count: counts[i],
  }))
}
function fmtN(v) {
  return v >= 100 ? Math.round(v).toString() : v.toFixed(1)
}

/** Normalize a single AI write-response into verdict/confidence/ids for cards. */
export function normalizeAIResult(kind, payload, input = {}) {
  if (!payload) return null
  if (kind === 'face') {
    const sim = input.cosine_similarity ?? payload.cosine_similarity ?? null
    return {
      verdict: payload.verification_status || 'unknown',
      confidence: sim === '' || sim === undefined ? null : sim,
      refId: payload.verification_id ?? null,
    }
  }
  if (kind === 'baggage') {
    return {
      verdict: payload.result || 'unknown',
      confidence: input.confidence ?? null,
      refId: payload.inspection_id ?? null,
      extra: { detections: payload.detections_logged ?? 0 },
    }
  }
  if (kind === 'scene' || kind === 'smoke-fire') {
    return {
      verdict: payload.behavior_type || payload.event_type || 'logged',
      confidence: null,
      refId: payload.alert_id ?? payload.event_id ?? null,
    }
  }
  return { verdict: 'logged', confidence: null, refId: null }
}

/* ---------- date presets -> real backend date_from/date_to (passengers report) ------ */
function isoDay(d) {
  return d.toISOString().slice(0, 10)
}
export const DATE_PRESETS = ['today', 'yesterday', 'last7', 'last30', 'custom']
export function presetRange(preset, custom = {}) {
  const now = new Date()
  const day = (offset) => { const d = new Date(now); d.setDate(d.getDate() + offset); return isoDay(d) }
  switch (preset) {
    case 'today': return { date_from: isoDay(now), date_to: day(1) }
    case 'yesterday': return { date_from: day(-1), date_to: isoDay(now) }
    case 'last7': return { date_from: day(-7), date_to: day(1) }
    case 'last30': return { date_from: day(-30), date_to: day(1) }
    case 'custom': return { date_from: custom.from || '', date_to: custom.to || '' }
    default: return { date_from: '', date_to: '' }
  }
}

/* ---------- auto insights: plain-language summary of ACTUAL payload numbers ------- */
export function summarizeReport(tab, d) {
  if (!d) return []
  const out = []
  const push = (t) => out.push(t)
  if (tab === 'passengers') {
    const tot = d.verified + d.failed
    push(`Database holds ${n(d.total)} passengers; ${n(d.checked_in)} checked in and ${n(d.boarded)} boarded.`)
    push(tot ? `Face verification success rate is ${((d.verified / tot) * 100).toFixed(1)}% across ${tot} attempts.` : 'No face verification attempts recorded yet.')
    const top = [...(d.by_nationality || [])].sort((a, b) => b.count - a.count)[0]
    if (top) push(`Largest nationality group: ${top.code || 'unknown'} (${n(top.count)} passengers).`)
  } else if (tab === 'flights') {
    const top = [...(d.by_status || [])].sort((a, b) => b.count - a.count)[0]
    push(`${n(d.total)} flights in scope${top ? `; most common status is "${top.status}" (${n(top.count)}).` : '.'}`)
    const bad = (d.by_status || []).filter((r) => /delay|cancel/i.test(r.status)).reduce((a, r) => a + r.count, 0)
    if (bad) push(`${n(bad)} flights need attention (delayed or cancelled).`)
  } else if (tab === 'baggage') {
    const bad = (d.by_result || []).filter((r) => r.result !== 'SAFE').reduce((a, r) => a + r.count, 0)
    push(`${n(d.total_bags)} bags tracked with ${n(d.inspections_total)} AI inspections.`)
    push(bad ? `${n(bad)} inspections require manual review.` : 'Every inspection cleared SAFE — no bags held.')
  } else if (tab === 'security') {
    push(`Verification rate ${(Number(d.verification_rate || 0) * 100).toFixed(1)}% over ${n(d.verifications_total)} attempts.`)
    push(`Gate decisions: ${n(d.gate_authorized)} authorized vs ${n(d.gate_denied)} denied.`)
  } else if (tab === 'ai') {
    push(`Models logged ${n(d.face_attempts)} face attempts (avg similarity ${Number(d.avg_similarity || 0).toFixed(3)}), ${n(d.inspections)} baggage inspections and ${n(d.monitoring_alerts)} monitoring alerts.`)
  } else if (tab === 'iot') {
    const bad = (d.by_status || []).filter((r) => !/ok|online|active/i.test(r.status)).reduce((a, r) => a + r.count, 0)
    push(`${n(d.devices_total)} devices registered${bad ? `; ${n(bad)} report a non-nominal status.` : ' — all nominal.'}`)
  } else if (tab === 'operations') {
    const open = (d.alerts || []).filter((a) => a.status === 'open').length
    push(`${n(d.emergencies_total)} emergencies and ${n(d.alerts_total)} monitoring alerts on record.`)
    push(open ? `${n(open)} alerts are still OPEN and need operator review.` : 'No open alerts — queue is clear.')
  }
  return out
}
function n(v) { return Number(v || 0).toLocaleString() }
