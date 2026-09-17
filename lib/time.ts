/**
 * 本地时间 —— 全库统一口径。
 *
 * 库里所有时间列都是**本地时间、无时区**（建表默认值是 `datetime('now', 'localtime')`）。
 * 不要用 `toISOString()` 写库：那是 UTC，服务器在东八区时会早 8 小时，
 * 且会让阶段驻留天数、时间线排序整体错位（2026-09-17 代码质检发现）。
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM-DD' */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 'YYYY-MM-DD HH:MM:SS'，写库用 */
export function localDateTime(d: Date = new Date()): string {
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}
