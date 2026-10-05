import Card from '../components/Card'
import useApi from '../hooks/useApi'

export default function Dashboard() {
  const { data, error, loading } = useApi('/api/v1/digital-twin/dashboard/live', [])
  return (
    <>
      <h1>Operations Dashboard</h1>
      <Card title="Live Monitoring">
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      </Card>
    </>
  )
}
