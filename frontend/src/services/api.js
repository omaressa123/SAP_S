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
    throw new Error(body?.detail || body?.error?.message || body?.data?.error || body?.message || `API error: ${res.status}`)
  }
  return body?.data !== undefined ? body.data : body
}

// Dedicated API service methods for Smart Gate & Airport Operations
export const SmartGateApi = {
  createKioskSession: async (payload = {}) => {
    try {
      const res = await fetch('http://localhost:8001/kiosk/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kiosk_id: 'KIOSK-B22', flight_id: 'QR-082', ...payload })
      })
      if (res.ok) return await res.json()
    } catch {
      // microservice fallback
    }
    return { session_id: Date.now() % 10000 }
  },

  scanPassport: (payload = {}) => api('/api/v1/kiosk/passport/scan', {
    method: 'POST',
    body: JSON.stringify({
      kioskEquipmentId: 4,
      rawMrzCode: 'P<USAMERCER<<ALEX<<<<<<<<<<<<<<<<<<<<<<<<<<<P982301A<4USA8806124M3101018<<<<<<<<<<<<<<06',
      documentType: 'passport',
      ...payload
    })
  }),

  scanPassportImage: (payload = {}) => api('/api/v1/kiosk/scan-passport-image', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  registerPassengerOcr: (payload = {}) => api('/api/v1/kiosk/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),

  compareFaceMatch: (payload = {}) => api('/api/v1/kiosk/compare-face-match', {
    method: 'POST',
    body: JSON.stringify(payload)
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
      ...payload
    })
  }),

  enrollGateFace: (payload = {}) => api('/api/v1/boarding-gate/enroll-face', {
    method: 'POST',
    body: JSON.stringify({
      passengerId: 4,
      flightNumber: 'QR-082',
      ...payload
    })
  }),

  getGateManifest: (flightNumber = 'QR-082') => api(`/api/v1/boarding-gate/manifest?flightNumber=${encodeURIComponent(flightNumber)}`),

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

export const ReportsApi = {
  overview: () => api('/api/v1/reports/overview'),
  passengers: (params = {}) => api(`/api/v1/reports/passengers${toQuery(params)}`),
  flights: (params = {}) => api(`/api/v1/reports/flights${toQuery(params)}`),
  baggage: (params = {}) => api(`/api/v1/reports/baggage${toQuery(params)}`),
  security: () => api('/api/v1/reports/security'),
  ai: () => api('/api/v1/reports/ai'),
  operations: () => api('/api/v1/reports/operations'),
}

function toQuery(params) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')),
  ).toString()
  return q ? `?${q}` : ''
}

export const AiApi = {
  faceVerify: (data) => api('/api/v1/ai/face/verify', { method: 'POST', body: JSON.stringify(data) }),
  baggageAnalyze: (data) => api('/api/v1/ai/baggage/analyze', { method: 'POST', body: JSON.stringify(data) }),
  smokeFire: (data) => api('/api/v1/ai/smoke-fire/analyze', { method: 'POST', body: JSON.stringify(data) }),
  scene: (data) => api('/api/v1/ai/scene/analyze', { method: 'POST', body: JSON.stringify(data) }),
  baggagePerson: (data) => api('/api/v1/ai/scene/baggage-person', { method: 'POST', body: JSON.stringify(data) }),
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

export const OrchestrationApi = {
  getModels: () => api('/api/v1/agents/models'),
  getDevices: () => api('/api/v1/agents/devices'),
  registerDevice: (payload) => api('/api/v1/agents/devices', { method: 'POST', body: JSON.stringify(payload) }),
  getDeployments: (sync = true) => api(`/api/v1/agents/deployments?sync=${sync}`),
  createDeployment: (payload) => api('/api/v1/agents/deployments', { method: 'POST', body: JSON.stringify(payload) }),
  stopDeployment: (id) => api(`/api/v1/agents/deployments/${id}/stop`, { method: 'POST' }),
  restartDeployment: (id) => api(`/api/v1/agents/deployments/${id}/restart`, { method: 'POST' }),
  repairDeployment: (id) => api(`/api/v1/agents/deployments/${id}/repair`, { method: 'POST' }),
  duplicateDeployment: (id, payload) => api(`/api/v1/agents/deployments/${id}/duplicate`, { method: 'POST', body: JSON.stringify(payload) }),
  removeDeployment: (id) => api(`/api/v1/agents/deployments/${id}`, { method: 'DELETE' }),
}

export const AgentNotificationApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== false))
    ).toString()
    return api(`/api/v1/agents/notifications${qs ? `?${qs}` : ''}`)
  },
  markRead: (id) => api(`/api/v1/agents/notifications/${id}/read`, { method: 'POST' }),
  acknowledge: (id) => api(`/api/v1/agents/notifications/${id}/acknowledge`, { method: 'POST' }),
  resolve: (id) => api(`/api/v1/agents/notifications/${id}/resolve`, { method: 'POST' }),
  markAllRead: () => api('/api/v1/agents/notifications/mark-all-read', { method: 'POST' }),
}

export const BaggageDropApi = {
  identifyPassenger: (payload = {}) => api('/api/v1/baggage-drop/identify-passenger', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  getManifestPassengers: (flightNumber = 'QR-082') => api(`/api/v1/baggage-drop/manifest-passengers?flightNumber=${flightNumber}`, {
    method: 'GET'
  }),
  weighBag: (payload = {}) => api('/api/v1/baggage-drop/weigh', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  issueTag: (payload = {}) => api('/api/v1/baggage-drop/issue-tag', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  dispatchBag: (payload = {}) => api('/api/v1/baggage-drop/dispatch', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
}

