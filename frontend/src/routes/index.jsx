import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { Loading } from '../components/States'

// Lazy-loaded route components: keeps the initial bundle lean and each
// AI module's CSS-3D scenes only mount when their route is visited.
const Dashboard = lazy(() => import('../pages/Dashboard'))
const Flights = lazy(() => import('../pages/Flights'))
const Passengers = lazy(() => import('../pages/Passengers'))
const Baggage = lazy(() => import('../pages/Baggage'))
const Monitoring = lazy(() => import('../pages/Monitoring'))
const DigitalTwin = lazy(() => import('../pages/DigitalTwin'))
const Reports = lazy(() => import('../pages/Reports'))
const AiCenter = lazy(() => import('../pages/AiCenter'))
const AIMonitor = lazy(() => import('../pages/AIMonitor'))
const FaceKiosk = lazy(() => import('../pages/FaceKiosk'))
const BaggageThreatDetection = lazy(() => import('../pages/ai/baggage/BaggageThreatDetectionPage'))
const SmokeFire = lazy(() => import('../pages/SmokeFire'))
const FullDetection = lazy(() => import('../pages/FullDetection'))
const IoTCenter = lazy(() => import('../pages/IoTCenter'))
const EGateKiosk = lazy(() => import('../pages/EGateKiosk'))
const EventCenter = lazy(() => import('../pages/EventCenter'))
const WorkflowMonitor = lazy(() => import('../pages/WorkflowMonitor'))
const GateBoarding = lazy(() => import('../pages/GateBoarding'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<main><Loading label="Loading airport module…" /></main>}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/flights" element={<Flights />} />
          <Route path="/passengers" element={<Passengers />} />
          <Route path="/baggage" element={<Baggage />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/digital-twin" element={<DigitalTwin />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/ai" element={<AiCenter />} />
          <Route path="/ai/face" element={<FaceKiosk />} />
          <Route path="/ai/baggage" element={<BaggageThreatDetection />} />
          <Route path="/ai/smoke-fire" element={<SmokeFire />} />
          <Route path="/ai/full-detection" element={<FullDetection />} />
          <Route path="/ai-monitor" element={<AIMonitor />} />
          <Route path="/iot" element={<IoTCenter />} />
          <Route path="/events" element={<EventCenter />} />
          <Route path="/workflows" element={<WorkflowMonitor />} />
        </Route>
        {/* Full-screen Terminal Kiosk Views */}
        <Route path="/egate" element={<EGateKiosk />} />
        <Route path="/kiosk" element={<EGateKiosk />} />
        <Route path="/gate-boarding" element={<GateBoarding />} />
        <Route path="/boarding-gate" element={<GateBoarding />} />
        <Route path="/entry-gate" element={<GateBoarding />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
