import React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  IdCard, ShieldCheck, Plane, Users, Monitor,
  Activity, FileText, ArrowRight, Smartphone, Lock, Eye, Sparkles, Luggage
} from 'lucide-react'

export default function PortalLanding() {
  const navigate = useNavigate()

  const MODULES = [
    {
      id: 'module-1',
      number: '01',
      title: 'Passenger Touchpoints',
      subtitle: 'Public Standalone Terminals (Kiosk Mode)',
      badge: 'Public Kiosks',
      badgeColor: '#10b981',
      gradient: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
      accentColor: '#10b981',
      description: 'Dedicated single-purpose monitor interfaces with zero administrative controls. Built for check-in kiosks, biometric security gates, and traveler boarding displays.',
      features: [
        'Full-screen single-station monitor locking',
        'Passport OCR & biometric facial matching',
        'Automated baggage tag & boarding pass issue',
        'Discrete Station Switcher for live demos',
      ],
      screens: [
        { label: 'E-Kiosk Check-In', path: '/terminals/kiosk', icon: IdCard, tag: 'Self-Service' },
        { label: 'Self Baggage Drop', path: '/terminals/baggage-drop', icon: Luggage, tag: 'Weigh & Tag' },
        { label: 'Security E-Gate A', path: '/terminals/security-gate', icon: ShieldCheck, tag: 'Biometric' },
        { label: 'Boarding Gate B22', path: '/terminals/boarding-gate', icon: Plane, tag: 'Departure' },
        { label: 'Passenger Mobile App', path: '/terminals/mobile', icon: Smartphone, tag: 'Traveler' },
      ],
      primaryCta: { label: 'Open Terminal Kiosk', path: '/terminals/kiosk' },
    },
    {
      id: 'module-2',
      number: '02',
      title: 'Staff Operations Portal',
      subtitle: 'Ground Operations & Security Desk',
      badge: 'Operator Station',
      badgeColor: '#f59e0b',
      gradient: 'linear-gradient(135deg, #78350f 0%, #b45309 100%)',
      accentColor: '#f59e0b',
      description: 'High-density operational workstation for airport security officers, baggage handlers, and gate agents managing passenger manifests and security screening.',
      features: [
        'Live CCTV camera surveillance feeds',
        'YOLO11 X-Ray baggage threat detection (BTD)',
        'Passenger database & manifest management',
        'Flight status, gate assignments & delay logging',
      ],
      screens: [
        { label: 'CCTV Security & Patrols', path: '/staff/monitoring', icon: ShieldCheck, tag: 'Surveillance' },
        { label: 'Baggage Threat AI (BTD)', path: '/staff/baggage-ai', icon: Monitor, tag: 'X-Ray AI' },
        { label: 'Flight Operations', path: '/staff/flights', icon: Plane, tag: 'Manifests' },
        { label: 'Passenger Database', path: '/staff/passengers', icon: Users, tag: 'Registry' },
      ],
      primaryCta: { label: 'Open Staff Operations', path: '/staff/monitoring' },
    },
    {
      id: 'module-3',
      number: '03',
      title: 'Executive Admin & AI Center',
      subtitle: 'Central Command & Multi-Agent Oversight',
      badge: 'Command & AI',
      badgeColor: '#6366f1',
      gradient: 'linear-gradient(135deg, #1e1b4b 0%, #4338ca 100%)',
      accentColor: '#6366f1',
      description: 'Macro airport oversight for directors, IT leads, and AI engineers. Monitor system-wide KPIs, agent workflow tasks, compliance reports, and model health.',
      features: [
        'System-wide executive KPI dashboard',
        'Multi-agent workflow orchestration & events',
        'Real-time AI model latency & accuracy monitor',
        'Historical reports, audits & disruption planner',
      ],
      screens: [
        { label: 'Executive Dashboard', path: '/admin/dashboard', icon: Activity, tag: 'KPIs' },
        { label: 'Live AI Monitoring', path: '/admin/ai-monitor', icon: Activity, tag: 'Realtime' },
        { label: 'Analytics & Reports', path: '/admin/reports', icon: FileText, tag: 'Audit' },
      ],
      primaryCta: { label: 'Open Command Center', path: '/admin/dashboard' },
    },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #071739 0%, #0d275e 40%, #f0f4f9 40%, #f8fafc 100%)',
      color: '#071739',
      fontFamily: "'Inter', sans-serif",
      padding: '48px 24px',
    }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        {/* Top Header */}
        <header style={{ textAlign: 'center', marginBottom: '48px', color: '#ffffff' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(227, 195, 157, 0.15)',
            border: '1px solid rgba(227, 195, 157, 0.4)',
            borderRadius: '999px',
            padding: '6px 18px',
            marginBottom: '18px',
          }}>
            <span style={{ color: '#E3C39D', fontSize: '13px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              ✈️ Smart Green Airport Architecture
            </span>
          </div>

          <h1 style={{
            fontSize: '2.75rem',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            margin: '0 0 12px 0',
            color: '#ffffff',
          }}>
            Airport Operational Modules
          </h1>
          <p style={{
            fontSize: '1.15rem',
            color: '#E3C39D',
            maxWidth: '680px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Decoupled subsystems engineered for dedicated airport environments: public touchpoint terminals, staff operations desks, and executive control.
          </p>
        </header>

        {/* 3 Main Module Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '28px',
          marginBottom: '48px',
        }}>
          {MODULES.map((mod) => (
            <div
              key={mod.id}
              style={{
                background: '#ffffff',
                borderRadius: '24px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 16px 40px rgba(7, 23, 57, 0.08)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 24px 56px rgba(7, 23, 57, 0.14)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 16px 40px rgba(7, 23, 57, 0.08)'
              }}
            >
              {/* Card Banner */}
              <div style={{
                background: mod.gradient,
                padding: '24px 28px',
                color: '#ffffff',
                position: 'relative',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    color: 'rgba(255,255,255,0.7)',
                    letterSpacing: '0.1em',
                  }}>
                    MODULE {mod.number}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    background: 'rgba(255,255,255,0.2)',
                    padding: '4px 10px',
                    borderRadius: '999px',
                  }}>
                    {mod.badge}
                  </span>
                </div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '1.45rem', fontWeight: 800, color: '#ffffff' }}>
                  {mod.title}
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)' }}>
                  {mod.subtitle}
                </div>
              </div>

              {/* Card Body */}
              <div style={{ padding: '28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.6, margin: '0 0 20px 0' }}>
                  {mod.description}
                </p>

                {/* Sub-Screen Launcher Grid */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: '#94a3b8',
                    marginBottom: '10px',
                  }}>
                    Sub-Screens & Monitor Views:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {mod.screens.map((scr) => {
                      const Icon = scr.icon
                      return (
                        <div
                          key={scr.path}
                          onClick={() => navigate(scr.path)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '10px 14px',
                            background: '#f8fafc',
                            borderRadius: '12px',
                            border: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#eef2ff'
                            e.currentTarget.style.borderColor = '#c7d2fe'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f8fafc'
                            e.currentTarget.style.borderColor = '#f1f5f9'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Icon size={16} style={{ color: mod.accentColor }} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#071739' }}>
                              {scr.label}
                            </span>
                          </div>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            background: '#ffffff',
                            color: '#64748b',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                          }}>
                            {scr.tag}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Primary Launch Action */}
                <div style={{ marginTop: 'auto' }}>
                  <button
                    onClick={() => navigate(mod.primaryCta.path)}
                    style={{
                      width: '100%',
                      background: '#071739',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '14px',
                      padding: '14px',
                      fontSize: '0.95rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'background 0.2s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#0d275e'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#071739'}
                  >
                    <span>{mod.primaryCta.label}</span>
                    <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Airport Topology Flow Diagram */}
        <div style={{
          background: '#ffffff',
          borderRadius: '24px',
          border: '1px solid #e2e8f0',
          padding: '32px',
          boxShadow: '0 8px 24px rgba(7, 23, 57, 0.04)',
        }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 800, color: '#071739' }}>
            Passenger Journey Flow Through Stations:
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
          }}>
            {[
              { step: '1. Traveler Mobile', desc: 'Book flight & receive digital pass on phone', path: '/terminals/mobile' },
              { step: '2. E-Kiosk Check-In', desc: 'Scan passport, print bag tag & boarding pass', path: '/terminals/kiosk' },
              { step: '3. Security E-Gate', desc: 'Biometric face match against passport', path: '/terminals/security-gate' },
              { step: '4. Baggage X-Ray (Staff)', desc: 'AI threat detection on checked baggage', path: '/staff/baggage-ai' },
              { step: '5. Gate B22 Boarding', desc: 'Biometric gate boarding verification', path: '/terminals/boarding-gate' },
            ].map((step, idx) => (
              <div
                key={step.step}
                onClick={() => navigate(step.path)}
                style={{
                  padding: '16px',
                  background: '#f8fafc',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#071739'
                  e.currentTarget.style.background = '#f0f5ff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e8f0'
                  e.currentTarget.style.background = '#f8fafc'
                }}
              >
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#071739', marginBottom: '4px' }}>
                  {step.step}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  {step.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
