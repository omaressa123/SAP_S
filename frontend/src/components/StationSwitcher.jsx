import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Monitor, Maximize2, Minimize2, Navigation, ShieldCheck,
  Plane, IdCard, Users, ArrowRight, ExternalLink, X, ChevronUp, Smartphone, Settings, Luggage
} from 'lucide-react'

export default function StationSwitcher({ currentStation = 'Airport Terminal Monitor' }) {
  const [open, setOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement))
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }

  const STATIONS = [
    {
      category: 'Passenger Touchpoints (Module 1)',
      items: [
        {
          path: '/terminals/kiosk',
          title: 'E-Kiosk Self Check-In',
          desc: 'Passenger document scan, baggage tags & boarding pass',
          icon: IdCard,
          badge: 'Check-in Hall',
          color: '#3b82f6',
        },
        {
          path: '/terminals/baggage-drop',
          title: 'AeroGate Self Baggage Drop',
          desc: 'Automated 3D volumetric scale, RFID bag tag dispenser & sorter',
          icon: Luggage,
          badge: 'Self-Drop #04',
          color: '#f59e0b',
        },
        {
          path: '/terminals/security-gate',
          title: 'Biometric Security E-Gate',
          desc: 'Face recognition & passport verification gate',
          icon: ShieldCheck,
          badge: 'Checkpoint A',
          color: '#10b981',
        },
        {
          path: '/terminals/boarding-gate',
          title: 'Biometric Boarding Gate',
          desc: 'Gate B22 live boarding clearance display',
          icon: Plane,
          badge: 'Gate B22',
          color: '#8b5cf6',
        },
        {
          path: '/terminals/mobile',
          title: 'Passenger Mobile App',
          desc: 'Traveler companion app & mobile boarding pass',
          icon: Smartphone,
          badge: 'Traveler App',
          color: '#06b6d4',
        },
      ],
    },
    {
      category: 'Staff Operations (Module 2)',
      items: [
        {
          path: '/staff/monitoring',
          title: 'CCTV Security & Patrols',
          desc: 'Terminal camera surveillance & incident alerts',
          icon: ShieldCheck,
          badge: 'Security Desk',
          color: '#f59e0b',
        },
        {
          path: '/staff/baggage-ai',
          title: 'Baggage Threat Detection',
          desc: 'YOLO11 X-Ray inspection & threat classification',
          icon: Monitor,
          badge: 'Baggage Area',
          color: '#ef4444',
        },
        {
          path: '/staff/flights',
          title: 'Flight Operations',
          desc: 'Flight manifests, gate scheduling & status',
          icon: Plane,
          badge: 'Ground Ops',
          color: '#6366f1',
        },
        {
          path: '/staff/passengers',
          title: 'Passenger Registry',
          desc: 'Manifest database, check-in lookup & overrides',
          icon: Users,
          badge: 'Desk Station',
          color: '#0ea5e9',
        },
      ],
    },
    {
      category: 'Command & Administration (Module 3)',
      items: [
        {
          path: '/admin/dashboard',
          title: 'Executive Control Dashboard',
          desc: 'Airport KPIs, zone occupancy & telemetry',
          icon: Settings,
          badge: 'Control Center',
          color: '#071739',
        },
        {
          path: '/admin/workflows',
          title: 'Multi-Agent Operations',
          desc: 'Autonomous agent task coordinator & events',
          icon: Navigation,
          badge: 'AI Ops',
          color: '#14b8a6',
        },
      ],
    },
  ]

  return (
    <>
      {/* Floating Station Switcher Pill */}
      <aside aria-label="Station switcher controls" style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(7, 23, 57, 0.94)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(227, 195, 157, 0.3)',
        borderRadius: '999px',
        padding: '6px 12px 6px 16px',
        boxShadow: '0 12px 32px rgba(7, 23, 57, 0.35)',
        color: '#ffffff',
        fontFamily: "'Inter', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 8px #10b981',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#E3C39D', letterSpacing: '0.02em' }}>
            {currentStation}
          </span>
        </div>

        <div style={{ height: '18px', width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 4px' }} />

        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'rgba(227, 195, 157, 0.15)',
            border: '1px solid rgba(227, 195, 157, 0.4)',
            color: '#ffffff',
            borderRadius: '999px',
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(227, 195, 157, 0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(227, 195, 157, 0.15)'}
          title="Switch display to another station or monitor"
        >
          <Navigation size={13} style={{ color: '#E3C39D' }} />
          <span>Switch Monitor</span>
          <ChevronUp size={13} />
        </button>

        <button
          onClick={toggleFullscreen}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.7)',
            padding: '6px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isFullscreen ? 'Exit Fullscreen' : 'Enter Kiosk Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      </aside>

      {/* Switcher Modal Dialog */}
      {open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(4, 15, 38, 0.75)',
          backdropFilter: 'blur(10px)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: '#ffffff',
            width: '100%',
            maxWidth: '880px',
            maxHeight: '90vh',
            borderRadius: '24px',
            boxShadow: '0 24px 64px rgba(7, 23, 57, 0.4)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div style={{
              background: 'linear-gradient(135deg, #071739 0%, #0d275e 100%)',
              padding: '24px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#ffffff',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '18px' }}>✈️</span>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#ffffff' }}>
                    Airport Terminal & Station Switcher
                  </h3>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#E3C39D' }}>
                  Select which station monitor to display, or jump between operational modules.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#ffffff',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '28px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {STATIONS.map((section) => (
                <div key={section.category}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    color: '#6b7280',
                    marginBottom: '12px',
                  }}>
                    {section.category}
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
                    gap: '12px',
                  }}>
                    {section.items.map((item) => {
                      const Icon = item.icon
                      const isActive = location.pathname === item.path
                      return (
                        <div
                          key={item.path}
                          onClick={() => {
                            setOpen(false)
                            navigate(item.path)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '14px',
                            padding: '14px 18px',
                            borderRadius: '16px',
                            border: isActive ? '2px solid #071739' : '1px solid #e5e7eb',
                            background: isActive ? '#f0f5ff' : '#ffffff',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) e.currentTarget.style.borderColor = '#cbd5e1'
                            e.currentTarget.style.transform = 'translateY(-2px)'
                            e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.06)'
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) e.currentTarget.style.borderColor = '#e5e7eb'
                            e.currentTarget.style.transform = 'none'
                            e.currentTarget.style.boxShadow = 'none'
                          }}
                        >
                          <div style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '12px',
                            background: `${item.color}15`,
                            color: item.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}>
                            <Icon size={20} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#071739' }}>
                                {item.title}
                              </span>
                              <span style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: '999px',
                                background: '#f3f4f6',
                                color: '#4b5563',
                              }}>
                                {item.badge}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.desc}
                            </div>
                          </div>
                          <ArrowRight size={16} style={{ color: isActive ? '#071739' : '#9ca3af' }} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 32px',
              background: '#f9fafb',
              borderTop: '1px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/')
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#4b5563',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <span>← Return to Central Portal Gateway</span>
              </button>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Press Esc or click outside to dismiss
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
