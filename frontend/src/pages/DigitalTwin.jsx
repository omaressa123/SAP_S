import { useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'
import { KvGrid, StatusBadge } from '../components/ai/AiVisuals'

export default function DigitalTwin() {
  const [form, setForm] = useState({ equipmentId: '', x: '', y: '', z: '', status: 'active' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    try {
      setResult(await api('/api/v1/digital-twin/position', {
        method: 'POST',
        body: JSON.stringify({ ...form, x: Number(form.x), y: Number(form.y), z: Number(form.z) }),
      }))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1>Digital Twin</h1>
      <Card title="Update equipment position">
        <form onSubmit={submit}>
          {Object.keys(form).map((k) => (
            <input key={k} placeholder={k} value={form[k]} onChange={set(k)} />
          ))}
          <Button>Update</Button>
        </form>
        {error && <p className="error">{error}</p>}
        {result && (
          <div style={{ marginTop: 10 }}>
            <p><StatusBadge tone="good">POSITION UPDATED</StatusBadge></p>
            <KvGrid items={[
              { k: 'Equipment', v: form.equipmentId },
              { k: 'Position', v: `(${form.x}, ${form.y}, ${form.z})` },
              { k: 'Status', v: form.status },
            ]} />
          </div>
        )}
      </Card>
    </>
  )
}
