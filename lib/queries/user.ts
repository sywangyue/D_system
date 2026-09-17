import { getDb } from "@/lib/db"

/**
 * 读用户保存的行业偏好。
 *
 * 存的是**中文原值**（`{"l1s":["机械和设备", …]}`），不是 slug ——
 * 换成 slug 会让已保存的偏好全部失配，且 /expo 按原值筛选会筛出 0 条（V2-13 §5.1）。
 * 列名 `dashboard_prefs` 是库里的列，**不改名**：改名要写迁移，收益为零。
 *
 * 服务端专用（用了 getDb）。/expo 与 /profile 两个服务端壳共用这一份实现。
 */
export function getIndustryPrefs(email: string): string[] {
  const row = getDb()
    .prepare('SELECT dashboard_prefs FROM user WHERE email = ?')
    .get(email) as { dashboard_prefs: string | null } | undefined
  if (!row?.dashboard_prefs) return []
  try {
    const parsed = JSON.parse(row.dashboard_prefs) as { l1s?: unknown }
    return Array.isArray(parsed?.l1s) ? (parsed.l1s as string[]) : []
  } catch {
    // 脏 JSON 不该让整页打不开：当作「没设过偏好」
    return []
  }
}
