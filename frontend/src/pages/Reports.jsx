import { useState } from 'react'
import Card from '../components/Card'
import useApi from '../hooks/useApi'
import { BarChart, EmptyState, ErrorState, Loading } from '../components/States'

const TABS = ['passengers', 'flights', 'baggage', 'security', 'ai', 'iot', 'operations']

export default function Reports() {
  const [tab, setTab] = useState('passengers')
  const [status, setStatus] = useState('')
  const path = tab === 'flights' && status
    ? `/api/v1/reports/flights?status=${encodeURIComponent(status)}`
    : `/api/v1/reports/${tab}`
  const { data, error, loading } = useApi(path, [tab, status])

  return (
    <>
      <h1>Reports</h1>
      <Card title="Report scope">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((t) => (
            <button key={t} className="btn" style={t === tab ? {} : { opacity: 0.55 }} onClick={() => setTab(t)}>{t}</button>
          ))}
        </div>
        {tab === 'flights' && (
          <p style={{ marginTop: 10 }}>
            <label>Status filter:{' '}
              <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="scheduled / boarding / departed / delayed / cancelled" style={{ width: 340 }} />
            </label>
          </p>
        )}
      </Card>
      {loading && <Loading />}
      {error && <ErrorState error={error} />}
      {!loading && !error && !data && <EmptyState />}
      {!loading && !error && data && (
        <>
          {tab === 'flights' && (
            <BarChart title="Flights by status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
          )}
          {tab === 'baggage' && (
            <>
              <BarChart title="Bags by status" rows={(data.by_status || []).map((r) => ({ label: r.status, count: r.count }))} />
              <BarChart title="Inspections by result" rows={(data.by_result || []).map((r) => ({ label: r.result, count: r.count }))} />
            </>
          )}
          {tab === 'passengers' && (
            <BarChart title="Passengers by nationality" rows={(data.by_nationality || []).map((r) => ({ label: r.code || 'unknown', count: r.count }))} />
          )}
          <Card title="Raw report payload"><pre>{JSON.stringify(data, null, 2)}</pre></Card>
        </>
      )}
    </>
  )
}
