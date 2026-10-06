import { useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'
import { KvGrid, StatusBadge } from '../components/ai/AiVisuals'

const initial = { flightNumber: '', airlineCode: '', originAirportCode: '', destinationAirportCode: '', scheduledDeparture: '', boardingGateCode: '' }

export default function Flights() {
  const [form, setForm] = useState(initial)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    try {
      setResult(await api('/api/v1/flights/create', { method: 'POST', body: JSON.stringify(form) }))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1>Flights</h1>
      <Card title="Create Flight">
        <form onSubmit={submit}>
          {Object.keys(initial).map((k) => (
            <input key={k} placeholder={k} value={form[k]} onChange={set(k)} />
          ))}
          <Button>Create</Button>
        </form>
        {error && <p className="error">{error}</p>}
        {result && (
          <div style={{ marginTop: 10 }}>
            <p><StatusBadge tone="good">FLIGHT CREATED</StatusBadge></p>
            <KvGrid items={[
              { k: 'Flight', v: result.flightNumber || result.flight_number || form.flightNumber },
              { k: 'Route', v: `${form.originAirportCode || result.originAirportCode || '—'} → ${form.destinationAirportCode || result.destinationAirportCode || '—'}` },
              { k: 'Status', v: result.status || 'scheduled' },
              { k: 'Record ID', v: result.flightId ?? result.flight_id ?? result.id ?? '—' },
            ]} />
          </div>
        )}
      </Card>
    </>
  )
}
