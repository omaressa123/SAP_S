import { useState, useEffect, useMemo } from 'react'
import {
  Award, CheckCircle2, Clock3, DoorOpen, MapPin, Plane, Send,
  Search, Filter, RefreshCw, AlertTriangle, Users, Luggage,
  Calendar, ChevronRight, X, Edit3, ArrowRight, Sparkles, Check,
  Clock, ShieldCheck, LayoutGrid, List, SlidersHorizontal, AlertOctagon,
  Activity, ArrowLeft, Fuel, Truck, UserCheck, Radio
} from 'lucide-react'
import Button from '../components/Button'
import Card from '../components/Card'
import { api } from '../services/api'
import { StatusBadge, KvGrid } from '../components/ai/AiVisuals'
import '../styles/Flights.css'

const initialCreate = {
  flightNumber: '',
  airlineCode: '',
  originAirportCode: '',
  destinationAirportCode: '',
  scheduledDeparture: '',
  boardingGateCode: ''
}

const fields = {
  flightNumber: { label: 'Flight number', placeholder: 'e.g., AA120', icon: Plane, autoComplete: 'off' },
  airlineCode: { label: 'Airline code', placeholder: 'e.g., AAL', icon: Award, autoComplete: 'off' },
  originAirportCode: { label: 'Origin airport code', placeholder: 'e.g., LAX', icon: MapPin, autoComplete: 'off' },
  destinationAirportCode: { label: 'Destination airport code', placeholder: 'e.g., JFK', icon: MapPin, autoComplete: 'off' },
  scheduledDeparture: { label: 'Scheduled departure time', type: 'datetime-local', icon: Clock3 },
  boardingGateCode: { label: 'Boarding gate code', placeholder: 'e.g., B22', icon: DoorOpen, autoComplete: 'off' },
}

// Built-in Airport Gates for the Interactive Gate Matrix & Apron Map View
const DEFAULT_GATES = [
  { gate: 'A01', terminal: 'T1', defaultFlight: 'MS800', type: 'Airbus A320neo', turnaround: 'Catering Complete', progress: 85, status: 'BOARDING' },
  { gate: 'A02', terminal: 'T1', defaultFlight: 'LH450', type: 'Airbus A321', turnaround: 'Baggage Loading', progress: 60, status: 'GATE OPEN' },
  { gate: 'B12', terminal: 'T2', defaultFlight: 'BA178', type: 'Boeing 787-9', turnaround: 'Fueling In Progress', progress: 45, status: 'SCHEDULED' },
  { gate: 'B18', terminal: 'T2', defaultFlight: 'EK202', type: 'Boeing 777-300ER', turnaround: 'Final Call', progress: 95, status: 'FINAL CALL' },
  { gate: 'B22', terminal: 'T2', defaultFlight: 'AA120', type: 'Boeing 777-200', turnaround: 'Smart Gate Active', progress: 78, status: 'BOARDING' },
  { gate: 'B24', terminal: 'T2', defaultFlight: null, type: 'Heavy Standby Bay', turnaround: 'Gate Clear & Available', progress: 0, status: 'AVAILABLE' },
  { gate: 'C01', terminal: 'T3', defaultFlight: 'AF66', type: 'Airbus A350-900', turnaround: 'Cleaning & Prep', progress: 30, status: 'SCHEDULED' },
  { gate: 'C05', terminal: 'T3', defaultFlight: 'DL108', type: 'Boeing 767-400', turnaround: 'Deboarding Completed', progress: 20, status: 'TURNAROUND' }
]

export default function Flights() {
  // Navigation tabs: 'fids' (Live FIDS Board), 'gates' (Apron & Gate Matrix), 'create' (Schedule Flight)
  const [activeTab, setActiveTab] = useState('fids')
  const [viewMode, setViewMode] = useState('table') // 'table' | 'gate-grid'

  // Operations Simulation Scenario (similar to CCTV Demo Scenarios)
  const [activeScenario, setActiveScenario] = useState('nominal')
  const [aiAdvisory, setAiAdvisory] = useState(null)

  // Flights data & filtering
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [toastMessage, setToastMessage] = useState(null)

  // Manifest Drawer state
  const [selectedFlight, setSelectedFlight] = useState(null)
  const [manifestData, setManifestData] = useState(null)
  const [manifestLoading, setManifestLoading] = useState(false)

  // Quick Status/Gate Edit Modal state
  const [editFlight, setEditFlight] = useState(null)
  const [editForm, setEditForm] = useState({ status: '', boardingGateCode: '', delayMinutes: 0, remarks: '' })
  const [editBusy, setEditBusy] = useState(false)

  // Create form state
  const [createForm, setCreateForm] = useState(initialCreate)
  const [createResult, setCreateResult] = useState(null)
  const [createError, setCreateError] = useState(null)
  const [createBusy, setCreateBusy] = useState(false)

  // Load flights on mount & listen for ESC key to close modal/drawer
  useEffect(() => {
    loadFlights()
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedFlight(null)
        setEditFlight(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const loadFlights = async () => {
    setLoading(true)
    try {
      const res = await api('/api/v1/flights/all')
      if (Array.isArray(res)) {
        setFlights(res)
      }
    } catch (err) {
      console.warn('Failed to load flights:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load manifest drawer for selected flight
  const openManifest = async (flight) => {
    setSelectedFlight(flight)
    setManifestLoading(true)
    setManifestData(null)
    try {
      const res = await api(`/api/v1/flights/${flight.flightId}/manifest`)
      setManifestData(res)
    } catch (err) {
      console.warn('Failed to load manifest:', err)
    } finally {
      setManifestLoading(false)
    }
  }

  // Open Quick Edit modal
  const openEditModal = (flight) => {
    setEditFlight(flight)
    setEditForm({
      status: flight.status || 'SCHEDULED',
      boardingGateCode: flight.boardingGate !== 'TBD' ? flight.boardingGate : '',
      delayMinutes: 0,
      remarks: ''
    })
  }

  // Submit Quick Edit status & gate update
  const handleSaveFlightStatus = async (e) => {
    e.preventDefault()
    if (!editFlight) return
    setEditBusy(true)
    try {
      const res = await api(`/api/v1/flights/${editFlight.flightId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(editForm)
      })
      setToastMessage(res?.message || `Flight ${editFlight.flightNumber} updated!`)
      setTimeout(() => setToastMessage(null), 4000)
      setEditFlight(null)
      loadFlights()
    } catch (err) {
      alert(`Update failed: ${err.message}`)
    } finally {
      setEditBusy(false)
    }
  }

  // Simulation scenario switch
  const handleScenarioChange = (scenarioKey) => {
    setActiveScenario(scenarioKey)
    if (scenarioKey === 'gate_conflict') {
      setAiAdvisory({
        type: 'warning',
        title: 'Gate B22 Inbound Conflict Detected',
        text: 'Inbound MS800 scheduled at 14:15 while outbound AA120 is boarding at Gate B22. Apron gridlock probability: 88%.',
        recommendation: 'Reassign inbound MS800 to Standby Gate B24 (Terminal 2 Pier B). Saves 16 min turnaround time.',
        targetFlightNumber: 'MS800',
        suggestedGate: 'B24'
      })
    } else if (scenarioKey === 'weather_delay') {
      setAiAdvisory({
        type: 'alert',
        title: 'Severe Convective Weather Advisory',
        text: 'Inbound Atlantic corridor thunderstorm cell delaying European & Transatlantic arrivals by +35-45 minutes.',
        recommendation: 'Broadcast +35 min delay advisory to FIDS boards and SMS notification agent.',
        targetFlightNumber: 'AA120',
        suggestedGate: 'B22'
      })
    } else if (scenarioKey === 'final_call') {
      setAiAdvisory({
        type: 'info',
        title: 'Final Call Smart Gate Sweep',
        text: 'Flight AA120 departure in 12 minutes. 14 passengers still unboarded in Terminal 2 retail zone.',
        recommendation: 'Trigger public gate chime & send push notifications to ArcFace registered passenger mobile devices.',
        targetFlightNumber: 'AA120',
        suggestedGate: 'B22'
      })
    } else {
      setAiAdvisory(null)
    }
  }

  // Apply AI optimization recommendation
  const handleApplyAiOptimization = async () => {
    if (!aiAdvisory) return
    const target = flights.find(f => f.flightNumber === aiAdvisory.targetFlightNumber) || flights[0]
    if (!target) return

    setEditBusy(true)
    try {
      await api(`/api/v1/flights/${target.flightId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: aiAdvisory.type === 'alert' ? 'DELAYED' : 'GATE OPEN',
          boardingGateCode: aiAdvisory.suggestedGate || 'B24',
          delayMinutes: aiAdvisory.type === 'alert' ? 35 : 0,
          remarks: `AI Auto-Optimization: ${aiAdvisory.title}`
        })
      })
      setToastMessage(`AI Agent Rebalance Applied: Flight ${target.flightNumber} updated!`)
      setTimeout(() => setToastMessage(null), 4000)
      setAiAdvisory(null)
      loadFlights()
    } catch (err) {
      alert(`AI Rebalance failed: ${err.message}`)
    } finally {
      setEditBusy(false)
    }
  }

  // Create new flight submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setCreateBusy(true)
    setCreateError(null)
    setCreateResult(null)
    try {
      const out = await api('/api/v1/flights/create', {
        method: 'POST',
        body: JSON.stringify(createForm)
      })
      setCreateResult(out)
      setCreateForm(initialCreate)
      loadFlights()
      setToastMessage(`Flight ${out.flightNumber} scheduled successfully!`)
      setTimeout(() => setToastMessage(null), 4000)
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreateBusy(false)
    }
  }

  // Filtered flights
  const filteredFlights = useMemo(() => {
    return flights.filter((f) => {
      const matchesSearch =
        (f.flightNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.airline || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.originAirport || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.destinationAirport || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.boardingGate || '').toLowerCase().includes(searchQuery.toLowerCase())

      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'DELAYED' && /delay/i.test(f.status)) ||
        (statusFilter === 'BOARDING' && /board/i.test(f.status)) ||
        (statusFilter === 'SCHEDULED' && /sched|time/i.test(f.status)) ||
        (statusFilter === 'DEPARTED' && /depart/i.test(f.status))

      return matchesSearch && matchesStatus
    })
  }, [flights, searchQuery, statusFilter])

  // Summary Metrics
  const stats = useMemo(() => {
    const total = flights.length
    const boarding = flights.filter((f) => /board/i.test(f.status)).length
    const delayed = flights.filter((f) => /delay/i.test(f.status)).length
    const departed = flights.filter((f) => /depart/i.test(f.status)).length
    const scheduled = flights.filter((f) => /sched|time/i.test(f.status)).length
    return { total, boarding, delayed, departed, scheduled }
  }, [flights])

  // Helper tone for flight status
  const getStatusTone = (status = '') => {
    const s = status.toLowerCase()
    if (s.includes('delay') || s.includes('cancel')) return 'bad'
    if (s.includes('board') || s.includes('gate open') || s.includes('final call')) return 'warn'
    if (s.includes('time') || s.includes('depart') || s.includes('sched')) return 'good'
    return 'idle'
  }

  return (
    <section className="flights-page" style={{ maxWidth: 1240, margin: '0 auto', paddingBottom: 50 }}>
      {/* ========================================== */}
      {/* TOP HEADER & VIEW MODE TABS                */}
      {/* ========================================== */}
      <header className="flights-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="flights-heading-icon" style={{ width: 44, height: 44, borderRadius: 12 }}>
            <Plane size={22} aria-hidden="true" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: '#071739', margin: 0 }}>
                Flight Operations Command
              </h1>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: '#ecfdf5',
                color: '#15803d',
                padding: '2px 8px',
                borderRadius: 12,
                fontSize: '0.72rem',
                fontWeight: 700
              }}>
                <Radio size={11} className="pulse" /> Live Multi-Agent Grid
              </span>
            </div>
            <p style={{ margin: '3px 0 0', color: '#64748b', fontSize: '0.85rem' }}>
              Real-time FIDS departure board, gate allocation matrix, turnaround tracking, and passenger manifests.
            </p>
          </div>
        </div>

        {/* Top Tab Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', background: '#e2e8f0', padding: 3, borderRadius: 9 }}>
          <button
            type="button"
            onClick={() => { setActiveTab('fids'); setViewMode('table') }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 15px',
              borderRadius: 7,
              border: 'none',
              background: activeTab === 'fids' && viewMode === 'table' ? '#007bb9' : 'transparent',
              color: activeTab === 'fids' && viewMode === 'table' ? '#ffffff' : '#334155',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <List size={14} /> FIDS Board ({flights.length})
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('fids'); setViewMode('gate-grid') }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 15px',
              borderRadius: 7,
              border: 'none',
              background: activeTab === 'fids' && viewMode === 'gate-grid' ? '#007bb9' : 'transparent',
              color: activeTab === 'fids' && viewMode === 'gate-grid' ? '#ffffff' : '#334155',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <LayoutGrid size={14} /> Gate Matrix View
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('create')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '7px 15px',
              borderRadius: 7,
              border: 'none',
              background: activeTab === 'create' ? '#007bb9' : 'transparent',
              color: activeTab === 'create' ? '#ffffff' : '#334155',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <Send size={14} /> Schedule Flight
          </button>
        </div>
      </header>

      {/* ========================================== */}
      {/* OPERATIONS SIMULATION CONTROL BAR          */}
      {/* ========================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12,
        padding: '12px 18px',
        borderRadius: 12,
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 800, color: '#071739' }}>
            <Sparkles size={16} color="#007bb9" /> Operations AI Simulation:
          </span>
          <select
            value={activeScenario}
            onChange={(e) => handleScenarioChange(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <option value="nominal">🟢 Nominal On-Schedule Airport Flow</option>
            <option value="gate_conflict">⚠️ Gate B22 Turnaround Conflict (Inbound MS800 vs AA120)</option>
            <option value="weather_delay">🌧️ Convective Weather Delay (+35 min Hold)</option>
            <option value="final_call">⚡ Final Call Gate Sweep (14 Unboarded Travelers)</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.76rem', color: '#64748b', fontWeight: 600 }}>Airport Grid Status:</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.74rem',
            fontWeight: 700
          }}>
            <Activity size={12} /> Autonomous Agent Online
          </span>
        </div>
      </div>

      {/* AI Advisory Callout Banner when a scenario is active */}
      {aiAdvisory && (
        <div style={{
          padding: '14px 18px',
          borderRadius: 10,
          background: aiAdvisory.type === 'alert' ? '#fff1f2' : aiAdvisory.type === 'warning' ? '#fffbeb' : '#f0f9ff',
          border: `1px solid ${aiAdvisory.type === 'alert' ? '#fecdd3' : aiAdvisory.type === 'warning' ? '#fde68a' : '#bae6fd'}`,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            {aiAdvisory.type === 'alert' ? (
              <AlertOctagon size={20} color="#e11d48" style={{ flexShrink: 0, marginTop: 2 }} />
            ) : aiAdvisory.type === 'warning' ? (
              <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
            ) : (
              <Sparkles size={20} color="#0284c7" style={{ flexShrink: 0, marginTop: 2 }} />
            )}
            <div>
              <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#071739' }}>
                {aiAdvisory.title}
              </div>
              <p style={{ margin: '3px 0 6px', fontSize: '0.8rem', color: '#475569', lineHeight: 1.4 }}>
                {aiAdvisory.text}
              </p>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0369a1' }}>
                💡 Recommendation: {aiAdvisory.recommendation}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={handleApplyAiOptimization}
              disabled={editBusy}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                borderRadius: 8,
                background: '#071739',
                color: '#ffffff',
                fontSize: '0.8rem',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
              }}
            >
              <Check size={14} /> {editBusy ? 'Applying…' : 'Apply AI Rebalance'}
            </button>
            <button
              type="button"
              onClick={() => setAiAdvisory(null)}
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Toast Alert Banner */}
      {toastMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: '#ecfdf5',
          border: '1px solid #86efac',
          borderRadius: 8,
          color: '#15803d',
          fontSize: '0.84rem',
          fontWeight: 700,
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} color="#16a34a" />
            <span>{toastMessage}</span>
          </div>
          <button onClick={() => setToastMessage(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#15803d' }}>✕</button>
        </div>
      )}

      {/* ========================================== */}
      {/* OPERATIONS KPI METRIC CARDS                */}
      {/* ========================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14,
        marginBottom: 20
      }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Active Flights Today</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#071739', marginTop: 4 }}>{stats.total}</div>
          <div style={{ fontSize: '0.75rem', color: '#0284c7', marginTop: 2 }}>{stats.scheduled} on normal schedule</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>Boarding Now</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#d97706', marginTop: 4 }}>{stats.boarding}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Gates active for passenger boarding</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase' }}>Delayed / Irregular</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: stats.delayed > 0 ? '#dc2626' : '#15803d', marginTop: 4 }}>{stats.delayed}</div>
          <div style={{ fontSize: '0.75rem', color: stats.delayed > 0 ? '#b91c1c' : '#15803d', marginTop: 2 }}>
            {stats.delayed > 0 ? 'Passenger notifications fired' : '100% on-schedule flow'}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Departed Flights</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#15803d', marginTop: 4 }}>{stats.departed}</div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2 }}>Airside pushback completed</div>
        </div>
      </div>

      {/* ========================================== */}
      {/* TAB 1: LIVE FIDS DEPARTURE BOARD           */}
      {/* ========================================== */}
      {activeTab === 'fids' && viewMode === 'table' && (
        <Card className="ops-glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* FIDS Filter and Search Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid #f1f5f9',
            background: '#ffffff'
          }}>
            {/* Search input */}
            <div style={{ position: 'relative', width: 320 }}>
              <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: 12, top: 11 }} />
              <input
                type="text"
                placeholder="Search flight, airline, destination, gate…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 36px',
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  fontSize: '0.84rem',
                  background: '#f8fafc'
                }}
              />
            </div>

            {/* Status Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, marginRight: 4 }}>Filter:</span>
              {['ALL', 'SCHEDULED', 'BOARDING', 'DELAYED', 'DEPARTED'].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 6,
                    border: statusFilter === st ? '1px solid #007bb9' : '1px solid #e2e8f0',
                    background: statusFilter === st ? '#e0f2fe' : '#ffffff',
                    color: statusFilter === st ? '#0369a1' : '#475569',
                    fontSize: '0.76rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {st}
                </button>
              ))}

              <Button
                type="button"
                onClick={loadFlights}
                disabled={loading}
                title="Refresh Flight Board"
                style={{
                  padding: '5px 10px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 6,
                  color: '#334155',
                  cursor: 'pointer',
                  marginLeft: 6
                }}
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} />
              </Button>
            </div>
          </div>

          {/* FIDS Flight Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Flight</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Airline</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Route</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Departure</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Gate</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569' }}>Load / Manifest</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, color: '#475569', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlights.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                      {loading ? 'Loading departures from database…' : 'No flights matching your filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredFlights.map((fl) => {
                    return (
                      <tr
                        key={fl.flightId}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {/* Flight Number */}
                        <td style={{ padding: '12px 16px', fontWeight: 800, color: '#071739' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Plane size={14} color="#007bb9" />
                            {fl.flightNumber}
                          </span>
                        </td>

                        {/* Airline */}
                        <td style={{ padding: '12px 16px', color: '#1e293b' }}>
                          <div style={{ fontWeight: 600 }}>{fl.airline}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{fl.airlineCode || 'IATA'}</div>
                        </td>

                        {/* Route */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: '#0f172a' }}>
                            <span>{fl.originAirport}</span>
                            <ArrowRight size={13} color="#94a3b8" />
                            <span>{fl.destinationAirport}</span>
                          </div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {fl.destinationCity || fl.destinationAirport}
                          </div>
                        </td>

                        {/* Scheduled Departure */}
                        <td style={{ padding: '12px 16px', color: '#334155', fontFamily: 'monospace', fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Clock size={13} color="#64748b" />
                            {fl.scheduledDeparture ? new Date(fl.scheduledDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '14:00'}
                          </div>
                          {fl.actualDeparture && (
                            <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>
                              Est: {new Date(fl.actualDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>

                        {/* Gate */}
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '3px 9px',
                            borderRadius: 6,
                            background: fl.boardingGate && fl.boardingGate !== 'TBD' ? '#f0fdf4' : '#f1f5f9',
                            color: fl.boardingGate && fl.boardingGate !== 'TBD' ? '#15803d' : '#64748b',
                            fontWeight: 700,
                            fontFamily: 'monospace'
                          }}>
                            <DoorOpen size={13} />
                            {fl.boardingGate || 'TBD'}
                          </span>
                        </td>

                        {/* Status */}
                        <td style={{ padding: '12px 16px' }}>
                          <StatusBadge tone={getStatusTone(fl.status)}>
                            {fl.status?.toUpperCase()}
                          </StatusBadge>
                        </td>

                        {/* Load / Manifest count */}
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Users size={14} color="#64748b" />
                            <span style={{ fontWeight: 600, color: '#334155' }}>
                              {fl.boardedCount ?? 0} / {fl.bookedCount || 20}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => openEditModal(fl)}
                              title="Update Gate or Flight Status"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 11px',
                                borderRadius: 6,
                                border: '1px solid #cbd5e1',
                                background: '#ffffff',
                                color: '#071739',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              <Edit3 size={12} color="#007bb9" /> Status
                            </button>

                            <button
                              type="button"
                              onClick={() => openManifest(fl)}
                              title="View Passenger Manifest"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '6px 12px',
                                borderRadius: 6,
                                border: 'none',
                                background: '#007bb9',
                                color: '#ffffff',
                                fontSize: '0.76rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              Manifest <ChevronRight size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ========================================== */}
      {/* GATE TERMINAL MATRIX & APRON MAP VIEW      */}
      {/* ========================================== */}
      {activeTab === 'fids' && viewMode === 'gate-grid' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#071739' }}>
                Terminal Gate Allocation & Turnaround Matrix
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Live apron turnaround states across Terminal 1, 2, and 3 gates. Click any gate card to manage flight status or manifest.
              </p>
            </div>
            <span style={{ fontSize: '0.78rem', color: '#007bb9', fontWeight: 700 }}>
              Showing {DEFAULT_GATES.length} Active Gate Stands
            </span>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16
          }}>
            {DEFAULT_GATES.map((g) => {
              const matchedFlight = flights.find(f => (f.boardingGate || '').toUpperCase() === g.gate.toUpperCase())
                || (g.defaultFlight ? flights.find(f => f.flightNumber === g.defaultFlight) : null)

              const isOccupied = !!matchedFlight || !!g.defaultFlight
              const displayStatus = matchedFlight ? matchedFlight.status : g.status

              return (
                <div
                  key={g.gate}
                  style={{
                    background: '#ffffff',
                    border: isOccupied ? '1px solid #cbd5e1' : '1px dashed #cbd5e1',
                    borderRadius: 12,
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    position: 'relative'
                  }}
                >
                  <div>
                    {/* Top Gate Badge */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: 6,
                          background: '#071739',
                          color: '#ffffff',
                          fontWeight: 800,
                          fontSize: '0.85rem',
                          fontFamily: 'monospace'
                        }}>
                          Gate {g.gate}
                        </span>
                        <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                          {g.terminal}
                        </span>
                      </div>

                      <span style={{
                        padding: '3px 8px',
                        borderRadius: 10,
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: displayStatus === 'BOARDING' ? '#fef3c7' : displayStatus === 'FINAL CALL' ? '#fee2e2' : displayStatus === 'AVAILABLE' ? '#f1f5f9' : '#eff6ff',
                        color: displayStatus === 'BOARDING' ? '#b45309' : displayStatus === 'FINAL CALL' ? '#b91c1c' : displayStatus === 'AVAILABLE' ? '#64748b' : '#1d4ed8'
                      }}>
                        {displayStatus}
                      </span>
                    </div>

                    {/* Flight Details */}
                    {isOccupied ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: '0.98rem', color: '#071739' }}>
                          <Plane size={15} color="#007bb9" />
                          <span>{matchedFlight ? matchedFlight.flightNumber : g.defaultFlight}</span>
                          <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>
                            ({matchedFlight ? matchedFlight.airline : 'Scheduled'})
                          </span>
                        </div>

                        <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 4 }}>
                          Aircraft: <strong>{g.type}</strong>
                        </div>

                        {/* Turnaround Milestone progress bar */}
                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, marginBottom: 4 }}>
                            <span style={{ color: '#334155' }}>Turnaround: {g.turnaround}</span>
                            <span style={{ color: '#007bb9' }}>{g.progress}%</span>
                          </div>
                          <div style={{ height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${g.progress}%`, height: '100%', background: '#007bb9', transition: 'width 0.3s ease' }} />
                          </div>
                        </div>

                        {/* Turnaround Milestone Badges */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap', fontSize: '0.68rem', color: '#475569' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f8fafc', padding: '2px 5px', borderRadius: 4 }}>
                            <Truck size={10} color="#16a34a" /> Baggage PPBM
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f8fafc', padding: '2px 5px', borderRadius: 4 }}>
                            <Fuel size={10} color="#0284c7" /> Fueling
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#f8fafc', padding: '2px 5px', borderRadius: 4 }}>
                            <UserCheck size={10} color="#8b5cf6" /> Smart Gate
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>Standby Bay Available</div>
                        <div style={{ fontSize: '0.72rem', marginTop: 2 }}>Ready for inbound turnaround allocation</div>
                      </div>
                    )}
                  </div>

                  {/* Actions for this Gate */}
                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    {matchedFlight ? (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditModal(matchedFlight)}
                          style={{
                            padding: '5px 9px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            color: '#334155',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Edit3 size={11} style={{ marginRight: 3 }} /> Gate/Status
                        </button>
                        <button
                          type="button"
                          onClick={() => openManifest(matchedFlight)}
                          style={{
                            padding: '5px 10px',
                            borderRadius: 6,
                            border: 'none',
                            background: '#007bb9',
                            color: '#ffffff',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          Manifest →
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditFlight({ flightNumber: 'New Assignment', boardingGate: g.gate, airline: 'Airport Gate Bay', originAirport: 'CAI', destinationAirport: 'TBD' })
                          setEditForm({ status: 'SCHEDULED', boardingGateCode: g.gate, delayMinutes: 0, remarks: 'Assigned via Gate Matrix' })
                        }}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#f8fafc',
                          color: '#071739',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        Assign Inbound Aircraft
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* TAB 2: SCHEDULE NEW FLIGHT FORM            */}
      {/* ========================================== */}
      {activeTab === 'create' && (
        <section className="flight-create-panel" aria-labelledby="flight-create-title" style={{ maxWidth: 860, margin: '0 auto' }}>
          <div className="flight-panel-glow" aria-hidden="true" />
          <div className="flight-panel-content">
            <div className="flight-panel-heading">
              <div>
                <span className="flight-panel-eyebrow">FLIGHT OPERATIONS</span>
                <h2 id="flight-create-title">Create New Flight Schedule</h2>
              </div>
              <span className="flight-step-badge"><span /> Operational Entry</span>
            </div>

            <form className="flight-form" onSubmit={handleCreateSubmit}>
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
                        value={createForm[key]}
                        onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.value })}
                        required
                      />
                    </label>
                  )
                })}
              </div>

              <div className="flight-route-fields">
                <div className="flight-route-topline"><span>ROUTE</span><span>Origin to destination IATA</span></div>
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
                            value={createForm[key]}
                            onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.value })}
                            required
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
                          value={createForm[key]}
                          onChange={(e) => setCreateForm({ ...createForm, [key]: e.target.value })}
                          required={key === 'scheduledDeparture'}
                        />
                        <Icon size={15} aria-hidden="true" />
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="flight-form-footer">
                <span className="flight-form-note"><CheckCircle2 size={15} /> Ready to commit into PostgreSQL</span>
                <Button className="flight-submit" disabled={createBusy}>
                  <span>{createBusy ? 'Scheduling…' : 'Schedule Flight'}</span>
                  <Send size={16} aria-hidden="true" />
                </Button>
              </div>
            </form>
          </div>
        </section>
      )}

      {createError && <p className="error flight-error" role="alert" style={{ marginTop: 16 }}>{createError}</p>}
      {createResult && (
        <section className="flight-result" aria-label="Created flight" style={{ marginTop: 20 }}>
          <p><StatusBadge tone="good">FLIGHT CREATED & BROADCASTED</StatusBadge></p>
          <KvGrid items={[
            { k: 'Flight', v: createResult.flightNumber },
            { k: 'Route', v: `${createResult.originAirport} → ${createResult.destinationAirport}` },
            { k: 'Assigned Gate', v: createResult.boardingGate || 'TBD' },
            { k: 'Status', v: createResult.status },
          ]} />
        </section>
      )}

      {/* ========================================== */}
      {/* QUICK STATUS & GATE REASSIGNMENT MODAL     */}
      {/* ========================================== */}
      {editFlight && (
        <div
          onClick={() => setEditFlight(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 23, 57, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 14,
              width: '100%',
              maxWidth: 480,
              overflow: 'hidden',
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#071739',
              color: '#ffffff'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
                  Manage Flight {editFlight.flightNumber}
                </h3>
                <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                  {editFlight.airline} • {editFlight.originAirport} → {editFlight.destinationAirport}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditFlight(null)}
                style={{ background: 'transparent', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveFlightStatus} style={{ padding: 20 }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Operational Flight Status
                </label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.86rem',
                    fontWeight: 600,
                    background: '#ffffff'
                  }}
                >
                  <option value="SCHEDULED">SCHEDULED (Normal Schedule)</option>
                  <option value="ON TIME">ON TIME</option>
                  <option value="GATE OPEN">GATE OPEN (Security Pre-screening)</option>
                  <option value="BOARDING">BOARDING (Smart Gate Active)</option>
                  <option value="FINAL CALL">FINAL CALL</option>
                  <option value="DELAYED">DELAYED</option>
                  <option value="DEPARTED">DEPARTED (Airside Closed)</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Boarding Gate Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. B22, A01"
                    value={editForm.boardingGateCode}
                    onChange={(e) => setEditForm({ ...editForm, boardingGateCode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
                      fontFamily: 'monospace',
                      fontWeight: 700
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                    Delay (Minutes)
                  </label>
                  <select
                    value={editForm.delayMinutes}
                    onChange={(e) => setEditForm({ ...editForm, delayMinutes: Number(e.target.value) })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: '0.86rem',
                      background: '#ffffff'
                    }}
                  >
                    <option value={0}>0 min (On Time)</option>
                    <option value={15}>+15 min Delay</option>
                    <option value={30}>+30 min Delay</option>
                    <option value={45}>+45 min Delay</option>
                    <option value={60}>+60 min Delay</option>
                    <option value={120}>+120 min Delay</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                  Operational Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Inbound aircraft late turnaround, weather alert"
                  value={editForm.remarks}
                  onChange={(e) => setEditForm({ ...editForm, remarks: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: '0.84rem'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setEditFlight(null)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <Button
                  className="ops-gradient-button"
                  disabled={editBusy}
                  style={{ padding: '8px 18px', fontSize: '0.84rem' }}
                >
                  <Check size={15} />
                  <span>{editBusy ? 'Updating…' : 'Save & Broadcast'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* PASSENGER & CARGO MANIFEST DRAWER          */}
      {/* ========================================== */}
      {selectedFlight && (
        <div
          onClick={() => setSelectedFlight(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(7, 23, 57, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 99999
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 640,
              background: '#ffffff',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 24px rgba(0,0,0,0.25)'
            }}
          >
            {/* Drawer Header with Back Button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              background: '#071739',
              color: '#ffffff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: '#007bb9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plane size={18} color="#ffffff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
                    {selectedFlight.flightNumber} Manifest
                  </h3>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {selectedFlight.airline} • {selectedFlight.originAirport} → {selectedFlight.destinationAirport}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setSelectedFlight(null)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.25)',
                    background: 'rgba(255,255,255,0.12)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  <ArrowLeft size={14} /> Back to Board
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedFlight(null)}
                  title="Close Drawer"
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 4 }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Manifest Content Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {manifestLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                  <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px', display: 'block', color: '#007bb9' }} />
                  Loading flight passenger manifest & cargo baggage logs…
                </div>
              ) : manifestData ? (
                <>
                  {/* Flight Overview Card */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 10,
                    padding: '14px 16px',
                    borderRadius: 10,
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    marginBottom: 18
                  }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>GATE</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#007bb9' }}>
                        {manifestData.flight.gate}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>STATUS</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#071739' }}>
                        {manifestData.flight.status}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>DEPARTURE</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                        {manifestData.flight.scheduledDeparture ? new Date(manifestData.flight.scheduledDeparture).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '14:00'}
                      </div>
                    </div>
                  </div>

                  {/* Boarding & Cargo Progress Bars */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: 6 }}>
                      <span style={{ color: '#334155' }}>Passenger Boarding Progress</span>
                      <span style={{ color: '#007bb9' }}>
                        {manifestData.stats.boardedCount} / {manifestData.stats.totalBooked} ({manifestData.stats.boardedPercent}%)
                      </span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ width: `${manifestData.stats.boardedPercent}%`, height: '100%', background: '#007bb9', transition: 'width 0.3s ease' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#64748b', marginTop: 10 }}>
                      <span>🧳 Checked Baggage: <strong>{manifestData.stats.totalBags} bags</strong></span>
                      <span>✈️ Cargo Loaded: <strong>{manifestData.stats.bagsLoaded} loaded</strong></span>
                    </div>
                  </div>

                  {/* Passenger Table */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 800, color: '#071739' }}>
                      Booked Passengers ({manifestData.manifest.length})
                    </h4>
                    <span style={{ fontSize: '0.74rem', color: '#64748b' }}>Positive Passenger Match (PPBM)</span>
                  </div>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Seat</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Passenger</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Class</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Biometrics</th>
                          <th style={{ padding: '8px 10px', color: '#475569' }}>Bags</th>
                          <th style={{ padding: '8px 10px', color: '#475569', textAlign: 'right' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {manifestData.manifest.map((p, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 800, color: '#007bb9', fontFamily: 'monospace' }}>
                              {p.seatNumber}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600, color: '#071739' }}>
                              <div>{p.fullName}</div>
                              <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{p.passportNumber}</div>
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>{p.cabinClass}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {p.hasBiometrics ? (
                                <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700, fontSize: '0.72rem' }}>
                                  <ShieldCheck size={12} /> ArcFace
                                </span>
                              ) : (
                                <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>Manual</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', color: '#475569' }}>
                              {p.bagCount} bag{p.bagCount !== 1 ? 's' : ''}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                              <span style={{
                                padding: '2px 7px',
                                borderRadius: 10,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                background: p.boardingStatus === 'BOARDED' ? '#ecfdf5' : '#eff6ff',
                                color: p.boardingStatus === 'BOARDED' ? '#15803d' : '#1d4ed8'
                              }}>
                                {p.boardingStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
                  No manifest details available.
                </div>
              )}
            </div>

            {/* Bottom Action Footer with Back Button */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              background: '#f8fafc',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12
            }}>
              <button
                type="button"
                onClick={() => setSelectedFlight(null)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 18px',
                  background: '#ffffff',
                  color: '#334155',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                <ArrowLeft size={15} /> Back to FIDS Board
              </button>

              <a
                href="/kiosk/gate-boarding"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  background: '#071739',
                  color: '#ffffff',
                  borderRadius: 8,
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
              >
                <DoorOpen size={16} /> Open Smart Gate Scanner →
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
