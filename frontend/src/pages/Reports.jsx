import { useEffect, useMemo, useState } from 'react'
import { BarChart as BarChartIcon } from 'lucide-react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { EmptyState, ErrorState, Loading } from '../components/States'
import { AiModuleLayout, EventTimeline } from '../components/ai/AiVisuals'
import { HBarList, Donut, LineChart, ZoneHeat, Histogram } from '../components/ai/Charts'
import { KPIGrid, ReportSummary, ReportFilters, PassengerFlowVisualization } from '../components/ai/Reusable'
import { buildHistogram, countBy, presetRange, summarizeReport } from '../utils/reportAdapters'

const TABS = ['passengers', 'flights', 'baggage', 'security', 'ai', 'iot', 'operations']

function buildPath(tab, f) {
  if (tab === 'passengers' && f.preset && f.preset !== 'all') {
    const r = presetRange(f.preset, f)
    const q = new URLSearchParams(Object.fromEntries(Object.entries(r).filter(([, v]) => v))).toString()
    return `/api/v1/reports/passengers${q ? `?${q}` : ''}`
  }
  if (tab === 'flights' && f.status) return `/api/v1/reports/flights?status=${encodeURIComponent(f.status)}`
  if (tab === 'baggage' && f.status) return `/api/v1/reports/baggage?status=${encodeURIComponent(f.status)}`
  return `/api/v1/reports/${tab}`
}

function rangeLabel(tab, f) {
  if (tab === 'passengers') {
    if (!f.preset || f.preset === 'all') return 'all time'
    if (f.preset === 'custom') return `${f.from || '?'} → ${f.to || '?'}`
    return f.preset
  }
  if ((tab === 'flights' || tab === 'baggage') && f.status) return `status = ${f.status}`
  return 'live snapshot'
}

export default function Reports() {
  const [tab, setTab] = useState('passengers')
  const [filters, setFilters] = useState({})
  const [nonce, setNonce] = useState(0)
  const [updatedAt, setUpdatedAt] = useState(null)
  const path = buildPath(tab, filters)
  const { data, error, loading } = useApi(path, [tab, JSON.stringify(filters), nonce])

  useEffect(() => { if (data) setUpdatedAt(new Date().toLocaleTimeString()) }, [data])
  useEffect(() => { setFilters({}) }, [tab])

  const memo = useMemo(() => {
    if (!data) return {}
    if (tab === 'baggage') {
      const items = data.detected_items || []
      return {
        itemTypes: countBy(items, 'item_type').slice(0, 8),
        confHist: buildHistogram(items.map((d) => d.confidence_score).filter((v) => v != null), 8, 0, 100),
      }
    }
    if (tab === 'ai') {
      const sims = (data.recent_verifications || []).map((v) => v.cosine_similarity).filter((v) => v !== null && v !== undefined)
      return { sims, simHist: buildHistogram(sims, 10, 0, 1) }
    }
    if (tab === 'operations') {
      return {
        alertsBySeverity: countBy(data.alerts || [], 'severity'),
        alertsByStatus: countBy(data.alerts || [], 'status'),
        emergByType: countBy(data.emergencies || [], 'event_type'),
      }
    }
    if (tab === 'iot') {
      return {
        healthCells: (data.recent_health || []).slice(0, 12).map((h) => ({
          label: `#${h.equipment_id}`, value: h.value ?? 1, severity: h.status_result === 'ok' ? 'low' : 'high',
        })),
      }
    }
    return {}
  }, [data, tab])

  const insights = useMemo(() => summarizeReport(tab, data), [tab, data])
  const resetFilters = () => setFilters({})

  return (
    <AiModuleLayout
      icon={<BarChartIcon size={22} />}
      title="Reports & Analytics"
      description="Every figure below is computed from live API responses and visualized — raw payloads are never shown."
      aiStatus={error ? 'offline' : 'online'}
      systemNote={loading ? 'updating…' : error ? 'backend unreachable' : `updated ${updatedAt || 'just now'}`}
      stats={[]}
    >
      {/* REPORT HEADER */}
      <div className="report-head">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="tablist" aria-label="Report scope">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" aria-selected={t === tab} className="btn" style={t === tab ? {} : { opacity: 0.55 }} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        <span className="spacer" />
        <span className="report-meta">Range: {rangeLabel(tab, filters)} · {loading ? 'refreshing…' : error ? 'offline' : `refreshed ${updatedAt || ''}`}</span>
        <button type="button" className="btn" onClick={() => setNonce((n) => n + 1)} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
      </div>

      <Card title="Report scope & filters">
        <ReportFilters tab={tab} value={filters} onChange={setFilters} />
      </Card>

      {loading && <Loading />}
      {error && <ErrorState error={error} onRetry={() => setNonce((n) => n + 1)} />}
      {!loading && !error && !data && <EmptyState />}
      {!loading && !error && data && (
        <>
          {tab === 'passengers' && (
            <>
              <KPIGrid items={[
                { label: 'Total passengers', value: data.total },
                { label: 'Verified', value: data.verified },
                { label: 'Failed', value: data.failed },
                { label: 'Checked in', value: data.checked_in },
                { label: 'Boarded', value: data.boarded },
              ]} />
              <PassengerFlowVisualization entering={data.checked_in || 0} leaving={data.boarded || 0} peak={data.total || 0} />
              <div className="dash-grid-2">
                <Donut title="Verification outcome" segments={[
                  { label: 'Verified', value: data.verified }, { label: 'Failed', value: data.failed },
                ]} />
                <HBarList title="Passengers by nationality" rows={(data.by_nationality || []).map((r) => ({ label: r.code || 'unknown', count: r.count }))} />
              </div>
              <ReportSummary insights={insights} />
            </>
          )}

          {tab === 'flights' && (
            <>
              <KPIGrid items={[
                { label: 'Flights (filtered)', value: data.total },
                ...(data.by_status || []).map((r) => ({ label: r.status, value: r.count })),
              ]} />
              {!(data.by_status || []).length && <EmptyState title="No flights in scope" hint="try clearing the status filter" icon="✈️" action={<button type="button" className="btn" onClick={resetFilters}>Reset filters</button>} />}
              <div className="dash-grid-2">
                <HBarList title="Flights by status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
                <Donut title="Status share" segments={(data.by_status || []).map((r) => ({ label: r.status, value: r.count }))} />
              </div>
              <ReportSummary insights={insights} />
              <Card title="Flight schedule — recent events">
                <EventTimeline
                  emptyHint="No flights match this filter."
                  events={(data.flights || []).slice(0, 10).map((f) => ({
                    title: `${f.flight_number} — ${f.status}`, time: f.scheduled_departure,
                    severity: /cancelled|delayed/.test(f.status) ? 'high' : 'low',
                    badge: f.status?.toUpperCase(), tone: f.status === 'cancelled' ? 'bad' : f.status === 'delayed' ? 'warn' : 'good',
                  }))}
                />
              </Card>
            </>
          )}

          {tab === 'baggage' && (
            <>
              <KPIGrid items={[
                { label: 'Total bags', value: data.total_bags },
                { label: 'Inspections', value: data.inspections_total },
                ...((data.by_result || []).map((r) => ({ label: `Result: ${r.result}`, value: r.count }))),
              ]} />
              <div className="dash-grid-2">
                <HBarList title="Bags by status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
                <Donut title="Inspection results" segments={(data.by_result || []).map((r) => ({ label: r.result, value: r.count }))} />
              </div>
              <div className="dash-grid-2">
                <Histogram title="Threat confidence distribution" bins={memo.confHist || []} emptyHint="no scored detections yet" />
                <HBarList title="Detected threat types" rows={memo.itemTypes || []} labelKey="label" valueKey="count" />
              </div>
              <ReportSummary insights={insights} />
              <Card title="Recent inspections — timeline">
                <EventTimeline
                  emptyHint="No inspections logged."
                  events={(data.recent_inspections || []).slice(0, 10).map((i) => ({
                    title: `Bag ${i.bag_id} — ${i.result}`, detail: `Inspection #${i.inspection_id} · ${i.ai_model_version || ''}`,
                    time: i.scan_time, severity: i.result === 'SAFE' ? 'low' : 'high',
                    badge: i.result, tone: i.result === 'SAFE' ? 'good' : 'bad',
                  }))}
                />
              </Card>
            </>
          )}

          {tab === 'security' && (
            <>
              <KPIGrid items={[
                { label: 'Verifications', value: data.verifications_total },
                { label: 'Verified', value: data.verified },
                { label: 'Failed', value: data.failed },
                { label: 'Verification rate', value: (data.verification_rate || 0) * 100, decimals: 1, suffix: '%' },
                { label: 'Gate authorized', value: data.gate_authorized },
                { label: 'Gate denied', value: data.gate_denied },
              ]} />
              <div className="dash-grid-2">
                <Donut title="Verification outcome" segments={[
                  { label: 'Verified', value: data.verified }, { label: 'Failed', value: data.failed },
                ]} />
                <HBarList title="Gate decisions" rows={[
                  { label: 'authorized', count: data.gate_authorized },
                  { label: 'denied', count: data.gate_denied },
                ]} />
              </div>
              <ReportSummary insights={insights} />
            </>
          )}

          {tab === 'ai' && (
            <>
              <KPIGrid items={[
                { label: 'Face attempts', value: data.face_attempts },
                { label: 'Avg similarity', value: data.avg_similarity, decimals: 3 },
                { label: 'Inspections', value: data.inspections },
                { label: 'Detected items', value: data.detected_items },
                { label: 'Monitoring alerts', value: data.monitoring_alerts },
              ]} />
              <div className="dash-grid-2">
                <LineChart title="Recent match scores (cosine similarity)" points={memo.sims || []} formatY={(v) => v.toFixed(2)} />
                <Histogram title="Similarity distribution" bins={memo.simHist || []} emptyHint="no scored verifications yet" />
              </div>
              <div className="dash-grid-2">
                <Donut title="AI workload" segments={[
                  { label: 'Face attempts', value: data.face_attempts },
                  { label: 'Inspections', value: data.inspections },
                  { label: 'Alerts', value: data.monitoring_alerts },
                ]} />
              </div>
              <ReportSummary insights={insights} />
              <Card title="Recent verifications — timeline">
                <EventTimeline
                  emptyHint="No verifications logged."
                  events={(data.recent_verifications || []).slice(0, 10).map((v) => ({
                    title: `Passenger ${v.passenger_id} — ${v.verification_status}`,
                    detail: v.cosine_similarity !== null && v.cosine_similarity !== undefined ? `similarity ${Number(v.cosine_similarity).toFixed(3)}` : 'no model score',
                    time: v.timestamp, severity: v.verification_status === 'verified' ? 'low' : 'high',
                    badge: v.verification_status?.toUpperCase(), tone: v.verification_status === 'verified' ? 'good' : 'bad',
                  }))}
                />
              </Card>
            </>
          )}

          {tab === 'iot' && (
            <>
              <KPIGrid items={[
                { label: 'Devices', value: data.devices_total },
                ...((data.by_status || []).map((r) => ({ label: r.status, value: r.count }))),
              ]} />
              <div className="dash-grid-2">
                <HBarList title="Devices by status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
                <ZoneHeat title="Latest equipment readings" cells={memo.healthCells || []} emptyHint="no health checks returned by API" />
              </div>
              <ReportSummary insights={insights} />
              <Card title="Recent health checks — timeline">
                <EventTimeline
                  emptyHint="No health checks logged."
                  events={(data.recent_health || []).slice(0, 10).map((h) => ({
                    title: `Equipment ${h.equipment_id} — ${h.metric_type}: ${h.value}`,
                    detail: h.status_result, time: h.check_time,
                    severity: h.status_result === 'ok' ? 'low' : 'high',
                    badge: h.status_result?.toUpperCase(), tone: h.status_result === 'ok' ? 'good' : 'bad',
                  }))}
                />
              </Card>
            </>
          )}

          {tab === 'operations' && (
            <>
              <KPIGrid items={[
                { label: 'Emergencies', value: data.emergencies_total },
                { label: 'Alerts', value: data.alerts_total },
              ]} />
              <div className="dash-grid-2">
                <HBarList title="Alerts by severity" rows={memo.alertsBySeverity || []} />
                <HBarList title="Emergencies by type" rows={memo.emergByType || []} />
              </div>
              <div className="dash-grid-2">
                <Donut title="Alert status" segments={(memo.alertsByStatus || []).map((r) => ({ label: r.label, value: r.count }))} />
                <HBarList title="Zone analysis — alert volume by severity" rows={memo.alertsBySeverity || []} />
              </div>
              <ReportSummary insights={insights} />
              <Card title="Alert timeline — recent events">
                <EventTimeline
                  emptyHint="No alerts in database."
                  events={(data.alerts || []).slice(0, 10).map((a) => ({
                    title: `${a.behavior_type} — ${a.severity}`, detail: `#${a.alert_id} · ${a.status}`,
                    time: a.timestamp, severity: a.severity,
                    badge: a.status?.toUpperCase(), tone: a.status === 'open' ? 'warn' : 'good',
                  }))}
                />
              </Card>
            </>
          )}
        </>
      )}
    </AiModuleLayout>
  )
}
