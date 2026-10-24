import { lazy, Suspense } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Loading } from '../components/States'

const Dashboard = lazy(() => import('./Dashboard'))
const EGateKiosk = lazy(() => import('./EGateKiosk'))
const GateBoarding = lazy(() => import('./GateBoarding'))
const Passengers = lazy(() => import('./Passengers'))
const Flights = lazy(() => import('./Flights'))
const Baggage = lazy(() => import('./Baggage'))
const Monitoring = lazy(() => import('./Monitoring'))

const WORKSPACE_PAGES = {
  overview: Dashboard,
  egate: EGateKiosk,
  'gate-boarding': GateBoarding,
  passengers: Passengers,
  flights: Flights,
  baggage: Baggage,
  security: Monitoring,
}

export default function OperationsWorkspace() {
  const { workspaceView } = useOutletContext()
  const Page = WORKSPACE_PAGES[workspaceView] || Dashboard

  return (
    <Suspense fallback={<Loading label="Loading airport operations…" />}>
      <Page />
    </Suspense>
  )
}
