const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function api(path, options = {}) {
  const token = localStorage.getItem('token')
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body?.error?.message || `API error: ${res.status}`)
  return body?.data ?? body
}
