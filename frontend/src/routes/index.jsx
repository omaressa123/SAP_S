import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Dashboard from '../pages/Dashboard'
import Flights from '../pages/Flights'
import Passengers from '../pages/Passengers'
import Baggage from '../pages/Baggage'
import Monitoring from '../pages/Monitoring'
import DigitalTwin from '../pages/DigitalTwin'
import Reports from '../pages/Reports'
import AiCenter from '../pages/AiCenter'
import FaceKiosk from '../pages/FaceKiosk'
import BaggageAI from '../pages/BaggageAI'
import SmokeFire from '../pages/SmokeFire'
import FullDetection from '../pages/FullDetection'
import IoTCenter from '../pages/IoTCenter'

export default function AppRoutes() {
  return (
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
  )
}
