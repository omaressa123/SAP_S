import { useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'

export default function Baggage() {
  const [bagId, setBagId] = useState('')
  const [history, setHistory] = useState(null)
  const [error, setError] = useState(null)

  const track = async (e) => {
    e.preventDefault()
    try {
      setHistory(await api(`/api/v1/baggage-tracking/history/${bagId}`))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1>Baggage Tracking</h1>
      <Card title="Track bag">
        <form onSubmit={track}>
          <input placeholder="Bag ID" value={bagId} onChange={(e) => setBagId(e.target.value)} />
          <Button>Track</Button>
        </form>
        {error && <p className="error">{error}</p>}
        {history && <pre>{JSON.stringify(history, null, 2)}</pre>}
      </Card>
    </>
  )
}
