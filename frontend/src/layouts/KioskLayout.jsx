import React, { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import StationSwitcher from '../components/StationSwitcher'
import { Plane, ShieldCheck, Clock, Wifi } from 'lucide-react'

export default function KioskLayout() {
  const [timeStr, setTimeStr] = useState('')
  const [dateStr, setDateStr] = useState('')
  const location = useLocation()

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setTimeStr(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      setDateStr(now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }))
    }
    updateTime()
    const timer = setInterval(updateTime, 1000)
    return () => clearInterval(timer)
  }, [])

  // Identify current terminal station for the status badge
  let stationName = 'Passenger Terminal'
  let stationCode = 'TERM-01'
  if (location.pathname.includes('kiosk')) {
    stationName = 'Self-Service Check-In Kiosk 04'
    stationCode = 'KIOSK-04'
  } else if (location.pathname.includes('security-gate')) {
    stationName = 'Biometric Security E-Gate A'
    stationCode = 'EGATE-A1'
  } else if (location.pathname.includes('boarding-gate')) {
    stationName = 'Biometric Boarding Gate B22'
    stationCode = 'GATE-B22'
  } else if (location.pathname.includes('mobile')) {
    stationName = 'Passenger Mobile Companion'
    stationCode = 'MOBILE-APP'
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: '#f8fafc',
      color: '#071739',
      fontFamily: "'Inter', sans-serif",
      position: 'relative',
    }}>
      {/* Kiosk Minimal Header */}
      <header style={{
        height: '64px',
        background: '#071739',
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        borderBottom: '2px solid #E3C39D',
        boxShadow: '0 4px 12px rgba(7, 23, 57, 0.15)',
        zIndex: 100,
      }}>
        {/* Left: Airport Logo & Station Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #E3C39D 0%, #c9a173 100%)',
            color: '#071739',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 900,
            fontSize: '18px',
          }}>
            ✈
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Smart Green Airport</span>
              <span style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                background: 'rgba(227, 195, 157, 0.2)',
                color: '#E3C39D',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid rgba(227, 195, 157, 0.4)',
                letterSpacing: '0.05em',
              }}>
                {stationCode}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              {stationName}
            </div>
          </div>
        </div>

        {/* Center: Live Terminal Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(255, 255, 255, 0.08)',
          padding: '6px 14px',
          borderRadius: '999px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 6px #10b981',
          }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#e2e8f0' }}>
            Station Online • Flight Ops Live
          </span>
        </div>

        {/* Right: Live Clock & Date */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#E3C39D', fontVariantNumeric: 'tabular-nums' }}>
              {timeStr}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
              {dateStr}
            </div>
          </div>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
          }}>
            <Wifi size={16} />
          </div>
        </div>
      </header>

      {/* Main Terminal Screen Content */}
      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'auto',
      }}>
        <Outlet />
      </main>

      {/* Station Switcher Floating Pill */}
      <StationSwitcher currentStation={stationName} />
    </div>
  )
}
