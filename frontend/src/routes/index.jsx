import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loading } from '../components/States'

// Layouts
const KioskLayout = lazy(() => import('../layouts/KioskLayout'))
const StaffLayout = lazy(() => import('../layouts/StaffLayout'))
const AdminLayout = lazy(() => import('../layouts/AdminLayout'))

// Portal Landing
const PortalLanding = lazy(() => import('../pages/PortalLanding'))
const PassengerMobileInfo = lazy(() => import('../pages/PassengerMobileInfo'))

// Terminal Screens (Module 1)
const EGateKiosk = lazy(() => import('../pages/EGateKiosk'))
const BaggageDrop = lazy(() => import('../pages/BaggageDrop'))
const GateBoarding = lazy(() => import('../pages/GateBoarding'))

// Staff Operations Pages (Module 2)
const Monitoring = lazy(() => import('../pages/Monitoring'))
const BaggageAI = lazy(() => import('../pages/BaggageAI'))
const Baggage = lazy(() => import('../pages/Baggage'))
const Flights = lazy(() => import('../pages/Flights'))
const Passengers = lazy(() => import('../pages/Passengers'))

// Admin & AI Governance Pages (Module 3)
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Reports = lazy(() => import('../pages/Reports'))
const AiCenter = lazy(() => import('../pages/AiCenter'))
const AIMonitor = lazy(() => import('../pages/AIMonitor'))
const FaceKiosk = lazy(() => import('../pages/FaceKiosk'))
const SmokeFire = lazy(() => import('../pages/SmokeFire'))
const FullDetection = lazy(() => import('../pages/FullDetection'))
const BaggagePersonDetection = lazy(() => import('../pages/BaggagePersonDetection'))
const IoTCenter = lazy(() => import('../pages/IoTCenter'))
const EventCenter = lazy(() => import('../pages/EventCenter'))
const WorkflowMonitor = lazy(() => import('../pages/WorkflowMonitor'))
const DisruptionPlanner = lazy(() => import('../pages/DisruptionPlanner'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loading label="Loading airport module…" /></main>}>
      <Routes>
        {/* Central Airport Portal Launcher */}
        <Route path="/" element={<PortalLanding />} />

        {/* ======================================================== */}
        {/* MODULE 1: PASSENGER TOUCHPOINTS & TERMINALS (KIOSK MODE) */}
        {/* ======================================================== */}
        <Route path="/terminals" element={<KioskLayout />}>
          <Route index element={<Navigate to="/terminals/kiosk" replace />} />
          <Route path="kiosk" element={<EGateKiosk />} />
          <Route path="baggage-drop" element={<BaggageDrop />} />
          <Route path="security-gate" element={<EGateKiosk />} />
          <Route path="boarding-gate" element={<GateBoarding />} />
          <Route path="mobile" element={<PassengerMobileInfo />} />
        </Route>

        {/* ======================================================== */}
        {/* MODULE 2: STAFF OPERATIONS PORTAL                        */}
        {/* ======================================================== */}
        <Route path="/staff" element={<StaffLayout />}>
          <Route index element={<Navigate to="/staff/monitoring" replace />} />
          <Route path="monitoring" element={<Monitoring />} />
          <Route path="baggage-ai" element={<BaggageAI />} />
          <Route path="baggage" element={<Baggage />} />
          <Route path="flights" element={<Flights />} />
          <Route path="passengers" element={<Passengers />} />
        </Route>

        {/* ======================================================== */}
        {/* MODULE 3: EXECUTIVE ADMIN & AI COMMAND CENTER            */}
        {/* ======================================================== */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="reports" element={<Reports />} />
          <Route path="ai" element={<AiCenter />} />
          <Route path="ai/baggage" element={<BaggageAI />} />
          <Route path="ai/face" element={<FaceKiosk />} />
          <Route path="ai/smoke-fire" element={<SmokeFire />} />
          <Route path="ai/full-detection" element={<FullDetection />} />
          <Route path="ai/baggage-person" element={<BaggagePersonDetection />} />
          <Route path="ai-monitor" element={<AIMonitor />} />
          <Route path="workflows" element={<WorkflowMonitor />} />
          <Route path="events" element={<EventCenter />} />
          <Route path="disruption" element={<DisruptionPlanner />} />
          <Route path="iot" element={<IoTCenter />} />
        </Route>

        {/* Backward-compatible redirects for legacy URLs */}
        <Route path="/kiosk" element={<Navigate to="/terminals/kiosk" replace />} />
        <Route path="/egate" element={<Navigate to="/terminals/security-gate" replace />} />
        <Route path="/boarding-gate" element={<Navigate to="/terminals/boarding-gate" replace />} />
        <Route path="/gate-boarding" element={<Navigate to="/terminals/boarding-gate" replace />} />
        <Route path="/entry-gate" element={<Navigate to="/terminals/boarding-gate" replace />} />
        <Route path="/monitoring" element={<Navigate to="/staff/monitoring" replace />} />
        <Route path="/flights" element={<Navigate to="/staff/flights" replace />} />
        <Route path="/passengers" element={<Navigate to="/staff/passengers" replace />} />
        <Route path="/baggage" element={<Navigate to="/staff/baggage" replace />} />
        <Route path="/reports" element={<Navigate to="/admin/reports" replace />} />
        <Route path="/ai" element={<Navigate to="/admin/ai" replace />} />
        <Route path="/ai/*" element={<Navigate to="/admin/ai" replace />} />
        <Route path="/ai-monitor" element={<Navigate to="/admin/ai-monitor" replace />} />
        <Route path="/workflows" element={<Navigate to="/admin/workflows" replace />} />
        <Route path="/events" element={<Navigate to="/admin/events" replace />} />
        <Route path="/disruption" element={<Navigate to="/admin/disruption" replace />} />
        <Route path="/iot" element={<Navigate to="/admin/iot" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
