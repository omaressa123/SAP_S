import Card from '../components/Card'
import Table from '../components/Table'
import useApi from '../hooks/useApi'

const columns = [
  { key: 'passengerId', label: 'ID' },
  { key: 'fullName', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'nationality', label: 'Nationality' },
  { key: 'passportNumber', label: 'Passport' },
]

export default function Passengers() {
  const { data, error, loading } = useApi('/api/v1/passenger/all', [])
  return (
    <>
      <h1>Passengers</h1>
      <Card>
        {loading && <p>Loading…</p>}
        {error && <p className="error">{error}</p>}
        {data && <Table columns={columns} rows={data} />}
      </Card>
    </>
  )
}
