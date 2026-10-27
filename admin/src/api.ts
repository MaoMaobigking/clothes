export const apiBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('admin_token')
  const response = await fetch(apiBase + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      localStorage.removeItem('admin_token')
      const loginPath = `${import.meta.env.BASE_URL}login`
      if (location.pathname !== loginPath) location.assign(loginPath)
    }
    throw new Error(data.message || data.error || `请求失败（${response.status}）`)
  }
  return data as T
}
