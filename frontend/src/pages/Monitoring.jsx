import { useState } from 'react'
import Card from '../components/Card'
import Button from '../components/Button'
import { api } from '../services/api'

export default function Monitoring() {
  const [form, setForm] = useState({ cameraId: '', zoneId: '', behaviorType: '', severity: '', unattendedDurationSeconds: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    try {
      setResult(await api('/api/v1/monitoring/cctv/detect', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          cameraId: Number(form.cameraId),
          zoneId: Number(form.zoneId),
          unattendedDurationSeconds: Number(form.unattendedDurationSeconds),
          detectedBoundingBox: { x: 0, y: 0, w: 0, h: 0 },
          snapshotBase64: '',
        }),
      }))
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <>
      <h1>CCTV Monitoring</h1>
      <Card title="Report detection">
        <form onSubmit={submit}>
          {Object.keys(form).map((k) => (
            <input key={k} placeholder={k} value={form[k]} onChange={set(k)} />
          ))}
          <Button>Submit</Button>
        </form>
        {error && <p className="error">{error}</p>}
        {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
      </Card>
    </>
  )
}
