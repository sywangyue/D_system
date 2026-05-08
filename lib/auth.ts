// ─── 客户端认证工具 ──────────────────────────────────────────────
// 从 localStorage 读取用户信息，替代 Supabase Auth 客户端

export interface UserInfo {
  userEmail: string | null
  isAdmin: boolean
}

/**
 * 从 localStorage 读取用户信息
 * 登录成功后由 /api/auth/login 或登录页面将 JWT payload 存入 'user_info'
 */
export function getUserInfo(): UserInfo {
  if (typeof window === 'undefined') {
    return { userEmail: null, isAdmin: false }
  }

  try {
    const raw = localStorage.getItem('user_info')
    if (!raw) return { userEmail: null, isAdmin: false }

    const parsed = JSON.parse(raw)
    return {
      userEmail: parsed.email ?? null,
      isAdmin: parsed.role === 'admin',
    }
  } catch {
    return { userEmail: null, isAdmin: false }
  }
}

/**
 * 清除登录态并跳转到 /login
 */
export function clearAuth(): void {
  localStorage.removeItem('user_info')
  // 清除 session cookie（通过设置一个过期 cookie）
  document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
  window.location.href = '/login'
}
