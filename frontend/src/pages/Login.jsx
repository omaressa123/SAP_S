import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import Button from '../components/Button'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    try {
      const data = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
      localStorage.setItem('token', data.token)
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="login-wrap">
      <div className="card"><form onSubmit={submit}>
        <h2 style={{ marginBottom: 16 }}>Smart Airport — Sign in</h2>
        <p style={{ fontSize: 12, color: "var(--color-secondary)", marginBottom: 8 }}>Test: admin / admin123*</p>
        <input placeholder="Username (admin)" value={email} onChange={(e) => setEmail(e.target.value)} style={{ marginBottom: 4 }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ marginBottom: 4 }} />
        {error && <p className="error">{error}</p>}
        <Button>Login</Button>
      </form></div>
    </div>
  )
}
