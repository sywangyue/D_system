const AUTH_KEY = 'mwlab_auth'

export interface UserInfo {
  email: string
  role: string
  display_name: string
}

export function saveAuth(info: UserInfo, token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(AUTH_KEY, JSON.stringify({ ...info, token }))
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
  document.cookie = 'session=; path=/; max-age=0'
}

export function isAuthenticated(): boolean {
  return getUserInfo() !== null
}
