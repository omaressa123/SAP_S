import React, { useState } from 'react'
import {
  Smartphone, QrCode, Plane, Luggage, Navigation, Bell,
  Leaf, User, ShieldCheck, CheckCircle2, ArrowRight
} from 'lucide-react'

export default function PassengerMobileInfo() {
  const [activeTab, setActiveTab] = useState('pass')

  const PASSENGER = {
    name: 'JOHNATHAN DOE',
    flight: 'QR 082',
    from: 'CAI',
    to: 'DOH',
    fromCity: 'Cairo Intl',
    toCity: 'Hamad Intl',
    date: '21 NOV 2026',
    boarding: '20:15',
    seat: '14A',
    gate: 'B22',
    class: 'Business',
    baggageId: 'BAG-994821',
    baggageStatus: 'Loaded on Aircraft',
  }

  return (
    <div style={{
      maxWidth: '1100px',
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Top Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #071739 0%, #0d275e 100%)',
        borderRadius: '24px',
        padding: '32px 40px',
        color: '#ffffff',
        marginBottom: '36px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '24px',
      }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(227, 195, 157, 0.2)',
            border: '1px solid rgba(227, 195, 157, 0.4)',
            borderRadius: '999px',
            padding: '4px 14px',
            color: '#E3C39D',
            fontSize: '12px',
            fontWeight: 700,
            marginBottom: '12px',
          }}>
            <Smartphone size={14} />
            <span>MODULE 1 COMPANION: TRAVELER CLIENT</span>
          </div>
          <h2 style={{ margin: '0 0 8px 0', fontSize: '1.85rem', fontWeight: 800, color: '#ffffff' }}>
            Passenger Mobile Experience
          </h2>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#cbd5e1', maxWidth: '600px', lineHeight: 1.6 }}>
            The native traveler client built with Expo React Native (<code style={{ color: '#E3C39D' }}>Passenger_App/</code>). Provides real-time gate push alerts, digital boarding passes, and live luggage telemetry.
          </p>
        </div>

        <div style={{
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid rgba(255,255,255,0.15)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#E3C39D', marginBottom: '6px' }}>
            MOBILE APP DIRECTORY
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ffffff' }}>
            /Passenger_App
          </div>
          <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '4px' }}>
            Expo 57 • React Native
          </div>
        </div>
      </div>

      {/* Main Content: Phone Simulator & Features */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '36px',
        alignItems: 'start',
      }}>
        {/* Left: Mobile Phone Simulation */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: '320px',
            borderRadius: '40px',
            background: '#071739',
            padding: '12px',
            boxShadow: '0 24px 60px rgba(7, 23, 57, 0.3)',
            border: '4px solid #1e293b',
          }}>
            {/* Phone Screen */}
            <div style={{
              background: '#f8fafc',
              borderRadius: '32px',
              overflow: 'hidden',
              minHeight: '580px',
              display: 'flex',
              flexDirection: 'column',
            }}>
              {/* Phone Status Bar */}
              <div style={{
                background: '#071739',
                color: '#ffffff',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '11px',
                fontWeight: 600,
              }}>
                <span>19:42</span>
                <span>5G • 98%</span>
              </div>

              {/* Phone App Header */}
              <div style={{
                background: '#071739',
                color: '#ffffff',
                padding: '16px',
                borderBottomLeftRadius: '20px',
                borderBottomRightRadius: '20px',
              }}>
                <div style={{ fontSize: '11px', color: '#E3C39D', fontWeight: 600 }}>SMART AIRPORT TRAVELER</div>
                <div style={{ fontSize: '15px', fontWeight: 800 }}>Hello, {PASSENGER.name.split(' ')[0]} 👋</div>
              </div>

              {/* Phone App Content */}
              <div style={{ padding: '16px', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {/* Boarding Pass Card */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  padding: '16px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  border: '1px solid #e2e8f0',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#071739' }}>{PASSENGER.flight}</span>
                    <span style={{ fontSize: '10px', background: '#dcfce7', color: '#15803d', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>ON TIME</span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#071739' }}>{PASSENGER.from}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{PASSENGER.fromCity}</div>
                    </div>
                    <Plane size={18} style={{ color: '#E3C39D' }} />
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: '#071739' }}>{PASSENGER.to}</div>
                      <div style={{ fontSize: '10px', color: '#64748b' }}>{PASSENGER.toCity}</div>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '8px',
                    padding: '8px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontSize: '10px',
                  }}>
                    <div>
                      <div style={{ color: '#64748b' }}>GATE</div>
                      <div style={{ fontWeight: 800, color: '#071739', fontSize: '13px' }}>{PASSENGER.gate}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>SEAT</div>
                      <div style={{ fontWeight: 800, color: '#071739', fontSize: '13px' }}>{PASSENGER.seat}</div>
                    </div>
                    <div>
                      <div style={{ color: '#64748b' }}>BOARDING</div>
                      <div style={{ fontWeight: 800, color: '#071739', fontSize: '13px' }}>{PASSENGER.boarding}</div>
                    </div>
                  </div>

                  {/* QR Code Placeholder */}
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    borderTop: '1px dashed #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '4px',
                  }}>
                    <QrCode size={48} style={{ color: '#071739' }} />
                    <span style={{ fontSize: '9px', color: '#94a3b8' }}>Scan at E-Gate / Boarding Gate</span>
                  </div>
                </div>

                {/* Baggage Status Card */}
                <div style={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Luggage size={16} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#071739' }}>Baggage #BAG-994821</div>
                    <div style={{ fontSize: '10px', color: '#16a34a', fontWeight: 600 }}>● {PASSENGER.baggageStatus}</div>
                  </div>
                </div>
              </div>

              {/* Phone Bottom Tab Bar */}
              <div style={{
                background: '#ffffff',
                borderTop: '1px solid #e2e8f0',
                padding: '10px 16px',
                display: 'flex',
                justifyContent: 'space-around',
                fontSize: '9px',
                fontWeight: 600,
                color: '#64748b',
              }}>
                <span style={{ color: '#071739' }}>Home</span>
                <span>Pass</span>
                <span>Luggage</span>
                <span>Map</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Architecture & Features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '20px',
            padding: '28px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.25rem', fontWeight: 800, color: '#071739' }}>
              How Mobile Integrates with Airport Stations
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#dcfce7',
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <QrCode size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#071739' }}>Mobile Barcode at E-Kiosks</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Passengers can scan their phone QR code directly at the physical check-in kiosk instead of their paper passport.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#e0f2fe',
                  color: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#071739' }}>Biometric Token Generation</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Once enrolled at the security gate, the traveler’s face token links to their mobile app session for seamless gate clearance.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: '#fef3c7',
                  color: '#b45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Luggage size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#071739' }}>Live Baggage Telemetry</div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Whenever staff or AI inspects and loads baggage, push events are sent directly to the passenger's device.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: '#f8fafc',
            borderRadius: '20px',
            padding: '24px',
            border: '1px solid #e2e8f0',
          }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 800, color: '#071739' }}>
              How to Run the Mobile App (Expo):
            </h4>
            <pre style={{
              background: '#071739',
              color: '#E3C39D',
              padding: '16px',
              borderRadius: '12px',
              fontSize: '0.8rem',
              overflowX: 'auto',
              margin: 0,
            }}>
cd Passenger_App
npm install
npx expo start
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}
