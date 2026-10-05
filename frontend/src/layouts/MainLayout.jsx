import { Navigate, Outlet } from 'react-router-dom'
import Navbar from '../components/Navbar'

export default function MainLayout() {
  if (!localStorage.getItem('token')) return <Navigate to="/login" replace />
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  )
}
