/**
 * Operational Analytics Dashboards:
 *   1. Passengers (/admin/reports/passengers)
 *   2. Flights    (/admin/reports/flights)
 *   3. Baggage    (/admin/reports/baggage)
 *   4. Operations (/admin/reports/operations)
 *
 * Every KPI card and chart (Pie, Histogram, Bar, Trend) renders strictly from
 * real PostgreSQL data via /api/v1/reports/*.
 */
import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import useApi from '../hooks/useApi'
import { Loading, ErrorState } from '../components/States'
import { Donut, Histogram, LineChart } from '../components/ai/Charts'
import Card from '../components/Card'

const PALETTE = ['#1d4ed8', '#0e7c4a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

const SECTION_META = {
  passengers: {
    title: 'Passengers Analytics',
    subtitle: 'Passenger volume, check-in, boarding, and identity verification activity.',
    endpoint: '/api/v1/reports/passengers',
  },
  flights: {
    title: 'Flights Analytics',
    subtitle: 'Flight schedule distribution and operational status tracking.',
    endpoint: '/api/v1/reports/flights',
  },
  baggage: {
    title: 'Baggage Analytics',
    subtitle: 'Baggage processing stages, throughput, and operational exceptions.',
    endpoint: '/api/v1/reports/baggage',
  },
  operations: {
    title: 'Operations Analytics',
    subtitle: 'Airport-wide operational activities, completion rates, and exceptions.',
    endpoint: '/api/v1/reports/operations',
  },
}

function pct(part, total) {
  if (!total) return '0.0%'
  return `${((Number(part || 0) / Number(total)) * 100).toFixed(1)}%`
}

function MetricCard({ label, value, sub, accent = '#071739' }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderTop: `3px solid ${accent}`,
      borderRadius: 12,
      padding: '14px 16px',
      boxShadow: '0 2px 6px rgba(15, 23, 42, 0.04)',
    }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginTop: 4 }}>
        {Number(value ?? 0).toLocaleString()}
      </div>
      {sub && (
        <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function ColoredBarChart({ title, rows = [] }) {
  if (!rows.length || !rows.some((r) => Number(r.count) > 0)) {
    return (
      <Card title={title}>
        <p style={{ color: '#64748b', fontSize: '0.86rem', margin: 0 }}>No operational records available.</p>
      </Card>
    )
  }
  const max = Math.max(...rows.map((r) => Number(r.count) || 0), 1)
  return (
    <Card title={title}>
      <div style={{ display: 'grid', gap: 10 }}>
        {rows.map((r, i) => {
          const val = Number(r.count) || 0
          const color = PALETTE[i % PALETTE.length]
          return (
            <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 56px', alignItems: 'center', gap: 10, fontSize: '0.84rem' }}>
              <span style={{ color: '#334155', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.label}
              </span>
              <div style={{ height: 12, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ width: `${(val / max) * 100}%`, height: '100%', background: color, borderRadius: 999 }} />
              </div>
              <strong style={{ textAlign: 'right', color: '#0f172a' }}>{val.toLocaleString()}</strong>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function Reports({ section = 'passengers' }) {
  const meta = SECTION_META[section] || SECTION_META.passengers
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [applied, setApplied] = useState({ from: '', to: '' })
  const [nonce, setNonce] = useState(0)

  const params = new URLSearchParams()
  if (applied.from) params.set('date_from', applied.from)
  if (applied.to) params.set('date_to', applied.to)
  const qs = params.toString()
  const url = `${meta.endpoint}${qs ? `?${qs}` : ''}`

  const { data, error, loading } = useApi(url, [url, nonce])

  useEffect(() => {
    const timer = setInterval(() => setNonce((n) => n + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const applyFilter = (e) => {
    e.preventDefault()
    setApplied({ from: dateFrom, to: dateTo })
  }

  const resetFilter = () => {
    setDateFrom('')
    setDateTo('')
    setApplied({ from: '', to: '' })
  }

  const refresh = useCallback(() => setNonce((n) => n + 1), [])

  if (loading && !data) {
    return (
      <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <h1>{meta.title}</h1>
        <Loading label={`Loading ${meta.title.toLowerCase()}…`} />
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
        <h1>{meta.title}</h1>
        <ErrorState error={error} onRetry={refresh} />
      </div>
    )
  }

  // Build KPIs & 4 chart datasets per section from real backend response
  let kpis = []
  let pieTitle = ''
  let pieSegments = []
  let histTitle = ''
  let histBins = []
  let barTitle = ''
  let barRows = []
  let trendTitle = ''
  let trendPoints = []

  if (section === 'passengers' && data) {
    const total = data.total ?? 0
    const checkedIn = data.checked_in ?? 0
    const boarded = data.boarded ?? 0
    const verified = data.verified ?? 0
    kpis = [
      { label: 'Total Passengers', value: total, sub: 'Registered in period', accent: '#1d4ed8' },
      { label: 'Checked-in Passengers', value: checkedIn, sub: `${pct(checkedIn, total)} of total`, accent: '#0e7c4a' },
      { label: 'Boarded Passengers', value: boarded, sub: `${pct(boarded, total)} of total`, accent: '#7c3aed' },
      { label: 'Verified Passengers', value: verified, sub: `${pct(verified, total)} of total`, accent: '#0891b2' },
    ]
    pieTitle = 'Passenger Distribution by Operational Status'
    pieSegments = (data.status_distribution || []).map((s) => ({ label: s.status, value: s.count }))
    histTitle = 'Passenger Activity Over Time (Histogram)'
    histBins = (data.activity_series || []).slice(-12)
    barTitle = 'Checked-in vs. Boarded vs. Verified'
    barRows = [
      { label: 'Checked-in', count: checkedIn },
      { label: 'Boarded', count: boarded },
      { label: 'Verified', count: verified },
    ]
    trendTitle = 'Passenger Processing Trend'
    trendPoints = (data.activity_series || []).map((p) => p.count)
  } else if (section === 'flights' && data) {
    const total = data.total ?? 0
    const byStatus = Object.fromEntries((data.by_status || []).map((s) => [String(s.status).toLowerCase(), s.count]))
    const active = (byStatus.active || 0) + (byStatus.boarding || 0) + (byStatus.in_air || 0)
    const scheduled = byStatus.scheduled || 0
    const departed = byStatus.departed || 0
    const arrived = byStatus.arrived || 0
    const delayed = byStatus.delayed || 0
    kpis = [
      { label: 'Total Flights', value: total, sub: 'All flight records', accent: '#1d4ed8' },
      { label: 'Active Flights', value: active, sub: `${pct(active, total)} of total`, accent: '#0e7c4a' },
      { label: 'Scheduled Flights', value: scheduled, sub: `${pct(scheduled, total)} of total`, accent: '#0891b2' },
      { label: 'Departed Flights', value: departed, sub: `${pct(departed, total)} of total`, accent: '#7c3aed' },
      { label: 'Arrived Flights', value: arrived, sub: `${pct(arrived, total)} of total`, accent: '#0f766e' },
      { label: 'Delayed Flights', value: delayed, sub: `${pct(delayed, total)} of total`, accent: '#dc2626' },
    ]
    pieTitle = 'Flight Distribution by Operational Status'
    pieSegments = (data.by_status || []).map((s) => ({ label: s.status, value: s.count }))
    histTitle = 'Flight Activity Over Time (Histogram)'
    histBins = (data.activity_series || []).slice(-12)
    barTitle = 'Flights by Operational Status'
    barRows = (data.by_status || []).map((s) => ({ label: s.status, count: s.count }))
    trendTitle = 'Flight Operational Trend'
    trendPoints = (data.activity_series || []).map((p) => p.count)
  } else if (section === 'baggage' && data) {
    const total = data.total_bags ?? 0
    const byStatus = Object.fromEntries((data.by_status || []).map((s) => [String(s.status).toLowerCase(), s.count]))
    const checkedIn = byStatus.checked_in || 0
    const inProcessing = (byStatus.screening || 0) + (byStatus.in_transit || 0) + (byStatus.stationary || 0) + (byStatus.processing || 0)
    const loaded = byStatus.loaded || 0
    const delivered = byStatus.delivered || byStatus.claimed || 0
    const exceptions = (data.by_result || []).filter((r) => r.result !== 'SAFE').reduce((a, r) => a + r.count, 0)
    kpis = [
      { label: 'Total Baggage Items', value: total, sub: `${data.inspections_total ?? 0} total inspections`, accent: '#1d4ed8' },
      { label: 'Baggage Checked-in', value: checkedIn, sub: `${pct(checkedIn, total)} of total`, accent: '#0e7c4a' },
      { label: 'In Processing', value: inProcessing, sub: `${pct(inProcessing, total)} of total`, accent: '#d97706' },
      { label: 'Baggage Loaded', value: loaded, sub: `${pct(loaded, total)} of total`, accent: '#7c3aed' },
      { label: 'Baggage Delivered', value: delivered, sub: `${pct(delivered, total)} of total`, accent: '#0891b2' },
      { label: 'Baggage Exceptions', value: exceptions, sub: 'Non-SAFE inspections', accent: '#dc2626' },
    ]
    pieTitle = 'Baggage Distribution by Processing Status'
    pieSegments = (data.by_status || []).map((s) => ({ label: s.status, value: s.count }))
    histTitle = 'Baggage Processing Volume Over Time'
    histBins = (data.activity_series || []).slice(-12)
    barTitle = 'Baggage Processing Stages'
    barRows = [
      { label: 'Checked-in', count: checkedIn },
      { label: 'In Processing', count: inProcessing },
      { label: 'Loaded', count: loaded },
      { label: 'Delivered', count: delivered },
      { label: 'Exceptions', count: exceptions },
    ]
    trendTitle = 'Baggage Processing Trend'
    trendPoints = (data.activity_series || []).map((p) => p.count)
  } else if (section === 'operations' && data) {
    const ops = data.operations_summary || {}
    const total = ops.total_activities ?? 0
    const completed = ops.completed ?? 0
    const inProgress = ops.in_progress ?? 0
    const pending = ops.pending ?? 0
    const exceptions = ops.exceptions ?? 0
    kpis = [
      { label: 'Total Operational Activities', value: total, sub: 'Check-ins, boardings, inspections, workflows', accent: '#1d4ed8' },
      { label: 'Completed Operations', value: completed, sub: `${pct(completed, total)} completion rate`, accent: '#0e7c4a' },
      { label: 'In-Progress Operations', value: inProgress, sub: `${pct(inProgress, total)} of total`, accent: '#d97706' },
      { label: 'Pending Operations', value: pending, sub: `${pct(pending, total)} of total`, accent: '#0891b2' },
      { label: 'Operational Exceptions', value: exceptions, sub: `${pct(exceptions, total)} of total`, accent: '#dc2626' },
    ]
    pieTitle = 'Overall Operational Status Distribution'
    pieSegments = (ops.by_status || []).map((s) => ({ label: s.status, value: s.count }))
    histTitle = 'Operational Activity Over Time'
    histBins = (ops.activity_series || []).slice(-12)
    barTitle = 'Operational Activities by Category'
    barRows = (ops.by_category || []).map((c) => ({ label: c.category, count: c.count }))
    trendTitle = 'Operational Activity Trend'
    trendPoints = (ops.activity_series || []).map((p) => p.count)
  }

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header + Date Range Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 14, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', color: '#071739' }}>{meta.title}</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>{meta.subtitle}</p>
        </div>

        <form onSubmit={applyFilter} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="date"
            aria-label="Date from"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
          />
          <input
            type="date"
            aria-label="Date to"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: '0.84rem' }}
          />
          <button
            type="submit"
            style={{ padding: '7px 12px', borderRadius: 8, border: 'none', background: '#071739', color: '#fff', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer' }}
          >
            Apply
          </button>
          {(applied.from || applied.to) && (
            <button
              type="button"
              onClick={resetFilter}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontSize: '0.84rem', cursor: 'pointer' }}
            >
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={refresh}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px',
              borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </form>
      </div>

      {/* KPI Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}>
        {kpis.map((k) => (
          <MetricCard key={k.label} label={k.label} value={k.value} sub={k.sub} accent={k.accent} />
        ))}
      </div>

      {/* 4 Visualizations: Pie, Histogram, Bar, Trend */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: 16,
      }}>
        <Donut title={pieTitle} segments={pieSegments} />
        <ColoredBarChart title={barTitle} rows={barRows} />
        <Histogram title={histTitle} bins={histBins} />
        <LineChart title={trendTitle} points={trendPoints} />
      </div>
    </div>
  )
}
