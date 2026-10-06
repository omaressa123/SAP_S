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
const FaceKiosk = lazy(() => import('../pages/FaceKiosk'))
const BaggageAI = lazy(() => import('../pages/BaggageAI'))
const SmokeFire = lazy(() => import('../pages/SmokeFire'))
const FullDetection = lazy(() => import('../pages/FullDetection'))
const IoTCenter = lazy(() => import('../pages/IoTCenter'))

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
          <Route path="/ai/baggage" element={<BaggageAI />} />
          <Route path="/ai/smoke-fire" element={<SmokeFire />} />
          <Route path="/ai/full-detection" element={<FullDetection />} />
          <Route path="/iot" element={<IoTCenter />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
