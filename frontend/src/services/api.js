const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': 'MOCK_API_KEY_123',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error?.message || body?.message || `API error: ${res.status}`)
  }
  return body?.data !== undefined ? body.data : body
}

// Dedicated API service methods for Smart Gate & Airport Operations
export const SmartGateApi = {
  scanPassport: (payload = {}) => api('/api/v1/kiosk/passport/scan', {
    method: 'POST',
    body: JSON.stringify({
      kioskEquipmentId: 4,
      rawMrzCode: 'P<USAMERCER<<ALEX<<<<<<<<<<<<<<<<<<<<<<<<<<<P982301A<4USA8806124M3101018<<<<<<<<<<<<<<06',
      documentType: 'passport',
      ...payload
    })
  }),

  enrollBiometrics: (payload = {}) => api('/api/v1/kiosk/biometrics/enroll', {
    method: 'POST',
    body: JSON.stringify({
      passengerId: 2,
      kioskEquipmentId: 4,
      capturedFaceBase64: '',
      ...payload
    })
  }),

  verifySecurityGate: (payload = {}) => api('/api/v1/security-gate/verify', {
    method: 'POST',
    body: JSON.stringify({
      gateId: 22,
      passengerId: 2,
      ...payload
    })
  }),

  verifyAndBoard: (payload = {}) => api('/api/v1/boarding-gate/verify-and-board', {
    method: 'POST',
    body: JSON.stringify({
      boardingGateId: 22,
      flightId: 1,
      passengerId: 2,
      ...payload
    })
  }),

  issueBoardingPass: (payload = {}) => api('/api/v1/kiosk/boarding-pass/issue', {
    method: 'POST',
    body: JSON.stringify({
      bookingId: 1,
      passengerId: 2,
      kioskEquipmentId: 4,
      bagsToRegisterCount: 1,
      ...payload
    })
  })
}

export const AirportApi = {
  getLiveDashboard: () => api('/api/v1/digital-twin/dashboard/live'),
  getFlights: () => api('/api/v1/flights/all'),
  createFlight: (flightData) => api('/api/v1/flights/create', {
    method: 'POST',
    body: JSON.stringify(flightData)
  }),
  getPassengers: () => api('/api/v1/passenger/all'),
  getBags: () => api('/api/v1/baggage-tracking/all'),
  getBagHistory: (bagId) => api(`/api/v1/baggage-tracking/history/${bagId}`),
  reportCctvDetection: (data) => api('/api/v1/monitoring/cctv/detect', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateDigitalTwinPosition: (data) => api('/api/v1/digital-twin/position', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}
