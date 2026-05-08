// 客户端认证工具 — localStorage-based JWT helpers
// 替代 Supabase Auth 客户端

const AUTH_KEY = 'mwlab_auth'

export interface UserInfo {
  email: string
  role: string
  display_name: string
}

export interface AuthState {
  userEmail: string | null
  isAdmin: boolean
}

export function saveAuth(info: UserInfo, token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...info, token }))
  localStorage.setItem('user_info', JSON.stringify({ email: info.email, role: info.role }))
}

export function getUserInfo(): UserInfo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return { email: parsed.email, role: parsed.role, display_name: parsed.display_name }
  } catch { return null }
}

export function getAuthState(): AuthState {
  const info = getUserInfo()
  if (!info) return { userEmail: null, isAdmin: false }
  return { userEmail: info.email, isAdmin: info.role === 'admin' }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    return JSON.parse(raw).token || null
  } catch { return null }
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(AUTH_KEY)
  localStorage.removeItem('user_info')
  document.cookie = 'session=; path=/; max-age=0'
}

export function isAuthenticated(): boolean {
  return getUserInfo() !== null
}
