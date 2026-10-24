import { useState } from 'react'
import Button from '../components/Button'
import { api } from '../services/api'
import { KvGrid, StatusBadge } from '../components/ai/AiVisuals'
import { Award, CheckCircle2, Clock3, DoorOpen, MapPin, Plane, Send } from 'lucide-react'
import '../styles/Flights.css'

const initial = { flightNumber: '', airlineCode: '', originAirportCode: '', destinationAirportCode: '', scheduledDeparture: '', boardingGateCode: '' }

const fields = {
  flightNumber: { label: 'Flight number', placeholder: 'e.g., AA120', icon: Plane, autoComplete: 'off' },
  airlineCode: { label: 'Airline code', placeholder: 'e.g., AAL', icon: Award, autoComplete: 'off' },
  originAirportCode: { label: 'Origin airport code', placeholder: 'e.g., LAX', icon: MapPin, autoComplete: 'off' },
  destinationAirportCode: { label: 'Destination airport code', placeholder: 'e.g., JFK', icon: MapPin, autoComplete: 'off' },
  scheduledDeparture: { label: 'Scheduled departure time', type: 'datetime-local', icon: Clock3 },
  boardingGateCode: { label: 'Boarding gate code', placeholder: 'e.g., B22', icon: DoorOpen, autoComplete: 'off' },
}

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
    <section className="flights-page">
      <header className="flights-heading">
        <div className="flights-heading-icon"><Plane size={19} aria-hidden="true" /></div>
        <div>
          <h1>Flights</h1>
          <p>Plan and manage departures across your airport.</p>
        </div>
      </header>

      <section className="flight-create-panel" aria-labelledby="flight-create-title">
        <div className="flight-panel-glow" aria-hidden="true" />
        <div className="flight-panel-content">
          <div className="flight-panel-heading">
            <div>
              <span className="flight-panel-eyebrow">FLIGHT OPERATIONS</span>
              <h2 id="flight-create-title">Create new flight</h2>
            </div>
            <span className="flight-step-badge"><span /> Step 1 of 2</span>
          </div>

          <div className="flight-progress" aria-label="Step 1 of 2: Basic info">
            <span className="flight-progress-active" />
            <span />
            <span>Basic info</span>
            <span>Flight details</span>
          </div>

          <form className="flight-form" onSubmit={submit}>
            <div className="flight-basic-fields">
              {['flightNumber', 'airlineCode'].map((key) => {
                const field = fields[key]
                const Icon = field.icon
                return (
                  <label className="flight-field" key={key} htmlFor={`flight-${key}`}>
                    <span className="flight-field-label">{field.label}<Icon size={15} aria-hidden="true" /></span>
                    <input
                      id={`flight-${key}`}
                      name={key}
                      autoComplete={field.autoComplete}
                      placeholder={field.placeholder}
                      value={form[key]}
                      onChange={set(key)}
                    />
                  </label>
                )
              })}
            </div>

            <div className="flight-route-fields">
              <div className="flight-route-topline"><span>ROUTE</span><span>Origin to destination</span></div>
              <div className="flight-route">
                {['originAirportCode', 'destinationAirportCode'].map((key, index) => {
                  const field = fields[key]
                  const Icon = field.icon
                  return (
                    <label className="flight-field" key={key} htmlFor={`flight-${key}`}>
                      <span className="flight-field-label">{index === 0 ? 'From' : 'To'}</span>
                      <span className="flight-field-caption">{field.label}</span>
                      <span className="flight-input-wrap">
                        <input
                          id={`flight-${key}`}
                          name={key}
                          autoComplete={field.autoComplete}
                          placeholder={field.placeholder}
                          value={form[key]}
                          onChange={set(key)}
                        />
                        <Icon size={15} aria-hidden="true" />
                      </span>
                    </label>
                  )
                })}
                <div className="flight-route-path" aria-hidden="true"><span /><Plane size={18} /></div>
              </div>
            </div>

            <div className="flight-details-fields">
              {['scheduledDeparture', 'boardingGateCode'].map((key) => {
                const field = fields[key]
                const Icon = field.icon
                return (
                  <label className="flight-field" key={key} htmlFor={`flight-${key}`}>
                    <span className="flight-field-label">{field.label}</span>
                    <span className="flight-input-wrap">
                      <input
                        id={`flight-${key}`}
                        name={key}
                        type={field.type || 'text'}
                        autoComplete={field.autoComplete}
                        placeholder={field.placeholder}
                        value={form[key]}
                        onChange={set(key)}
                      />
                      <Icon size={15} aria-hidden="true" />
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="flight-form-footer">
              <span className="flight-form-note"><CheckCircle2 size={15} /> Ready to add to the schedule</span>
              <Button className="flight-submit"><span>Schedule flight</span><Send size={16} aria-hidden="true" /></Button>
            </div>
          </form>
        </div>
      </section>

      {error && <p className="error flight-error" role="alert">{error}</p>}
      {result && (
        <section className="flight-result" aria-label="Created flight">
          <p><StatusBadge tone="good">FLIGHT CREATED</StatusBadge></p>
          <KvGrid items={[
            { k: 'Flight', v: result.flightNumber || result.flight_number || form.flightNumber },
            { k: 'Route', v: `${form.originAirportCode || result.originAirportCode || '—'} → ${form.destinationAirportCode || result.destinationAirportCode || '—'}` },
            { k: 'Status', v: result.status || 'scheduled' },
            { k: 'Record ID', v: result.flightId ?? result.flight_id ?? result.id ?? '—' },
          ]} />
        </section>
      )}
    </section>
  )
}
