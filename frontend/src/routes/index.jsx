import { Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from '../layouts/MainLayout'
import Dashboard from '../pages/Dashboard'
import Flights from '../pages/Flights'
import Passengers from '../pages/Passengers'
import Baggage from '../pages/Baggage'
import Monitoring from '../pages/Monitoring'
import DigitalTwin from '../pages/DigitalTwin'

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
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
