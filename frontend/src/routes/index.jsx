import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import { Loading } from '../components/States'

// Lazy-loaded route components: keeps the initial bundle lean and each
// AI module's CSS-3D scenes only mount when their route is visited.
const DisruptionPlanner = lazy(() => import('../pages/DisruptionPlanner'))
const OperationsWorkspace = lazy(() => import('../pages/OperationsWorkspace'))
const DigitalTwin = lazy(() => import('../pages/DigitalTwin'))
const Reports = lazy(() => import('../pages/Reports'))
const AiCenter = lazy(() => import('../pages/AiCenter'))
const AIMonitor = lazy(() => import('../pages/AIMonitor'))
const FaceKiosk = lazy(() => import('../pages/FaceKiosk'))
const BaggageThreatDetection = lazy(() => import('../pages/ai/baggage/BaggageThreatDetectionPage'))
const SmokeFire = lazy(() => import('../pages/SmokeFire'))
const FullDetection = lazy(() => import('../pages/FullDetection'))
const IoTCenter = lazy(() => import('../pages/IoTCenter'))
const EventCenter = lazy(() => import('../pages/EventCenter'))
const WorkflowMonitor = lazy(() => import('../pages/WorkflowMonitor'))

export default function AppRoutes() {
  return (
    <Suspense fallback={<main><Loading label="Loading airport module…" /></main>}>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<OperationsWorkspace />} />
          <Route path="/flights" element={<Navigate to="/" state={{ workspaceView: 'flights' }} replace />} />
          <Route path="/passengers" element={<Navigate to="/" state={{ workspaceView: 'passengers' }} replace />} />
          <Route path="/baggage" element={<Navigate to="/" state={{ workspaceView: 'baggage' }} replace />} />
          <Route path="/monitoring" element={<Navigate to="/" state={{ workspaceView: 'security' }} replace />} />
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
          <Route path="/disruption" element={<DisruptionPlanner />} />
          <Route path="/egate" element={<Navigate to="/" state={{ workspaceView: 'egate' }} replace />} />
          <Route path="/kiosk" element={<Navigate to="/" state={{ workspaceView: 'egate' }} replace />} />
          <Route path="/gate-boarding" element={<Navigate to="/" state={{ workspaceView: 'gate-boarding' }} replace />} />
          <Route path="/boarding-gate" element={<Navigate to="/" state={{ workspaceView: 'gate-boarding' }} replace />} />
          <Route path="/entry-gate" element={<Navigate to="/" state={{ workspaceView: 'gate-boarding' }} replace />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
