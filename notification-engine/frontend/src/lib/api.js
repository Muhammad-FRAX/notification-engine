const BASE = '/api'

class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function request(path, options = {}) {
  const token = localStorage.getItem('admin_token')
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401 && path !== '/admin/auth/login') {
    localStorage.removeItem('admin_token')
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    let body
    try { body = await res.json() } catch { body = null }
    throw new ApiError(res.status, body)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path, opts) => request(path, { method: 'GET', ...opts }),
  post: (path, body, opts) =>
    request(path, { method: 'POST', body: JSON.stringify(body), ...opts }),
  put: (path, body, opts) =>
    request(path, { method: 'PUT', body: JSON.stringify(body), ...opts }),
  patch: (path, body, opts) =>
    request(path, { method: 'PATCH', body: JSON.stringify(body), ...opts }),
  delete: (path, opts) => request(path, { method: 'DELETE', ...opts }),
}

export { ApiError }
