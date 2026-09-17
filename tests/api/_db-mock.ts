import { vi } from "vitest"
import type { Mock } from "vitest"

type Row = Record<string, unknown>

interface FakeStatement {
  get: Mock<(...args: unknown[]) => Row | null>
  all: Mock<(...args: unknown[]) => Row[]>
  run: Mock<(...args: unknown[]) => { changes: number; lastInsertRowid: number }>
}

export interface FakeDb {
  prepare: Mock<(sql: string) => FakeStatement>
  pragma: Mock
  close: Mock
}

export function fakeStatement(rows: Row | Row[]): FakeStatement {
  const data = Array.isArray(rows) ? rows : [rows]
  return {
    get: vi.fn(() => (Array.isArray(rows) ? rows[0] ?? null : rows)),
    all: vi.fn(() => data),
    run: vi.fn(() => ({ changes: 1, lastInsertRowid: 1 })),
  }
}

/** Build a mock db that matches SQL snippets to data.
 *  Each entry: [sqlSnippet, method, rows]
 *  Example: ["FROM exhibition_brand", "get", { total_area: 0 }]
 */
export function buildMockDb(
  matchers: Array<[sqlSnippet: string, method: "get" | "all" | "run", rows: Row | Row[]]>,
): FakeDb {
  return {
    prepare: vi.fn((sql: string) => {
      for (const [snippet, method, rows] of matchers) {
        if (sql.includes(snippet)) {
          const stmt = fakeStatement(rows)
          // Override to return the right method result
          if (method === "get") {
            stmt.get = vi.fn(() => (Array.isArray(rows) ? rows[0] ?? null : rows))
            stmt.all = vi.fn(() => [])
          }
          if (method === "all") {
            stmt.all = vi.fn(() => (Array.isArray(rows) ? rows : [rows]))
            stmt.get = vi.fn(() => null)
          }
          return stmt
        }
      }
      // Fallback: empty
      return fakeStatement([])
    }),
    pragma: vi.fn(() => []),
    close: vi.fn(),
  }
}

export function buildMockGetDb(matchers: Array<[string, "get" | "all" | "run", Row | Row[]]>) {
  return () => buildMockDb(matchers)
}

/* ------------------------------------------------------------------ *
 * 写端点用：可记录的 mock
 *
 * buildMockDb 的 run() 恒返回 { changes: 1 }，且不保留调用痕迹 ——
 * 断言不了「UPDATE 只带了请求体里出现的列」「阶段变更写了 opportunity_event」
 * 「DELETE 命中 0 行」这几件事。下面这版把每次 prepare/get/all/run
 * 连同**实参**都记进 log，并支持按 matcher 指定 run 结果（或让它抛错）。
 *
 * 不动上面三个导出的行为，只新增。
 * ------------------------------------------------------------------ */

export interface RunResult {
  changes?: number
  lastInsertRowid?: number
}

export type MatcherResolver = (sql: string, args: unknown[]) => Row | Row[]
export type RunResolver = (sql: string, args: unknown[]) => RunResult

/** [SQL 片段, 调用的方法, 返回数据] —— 片段命中即用该数据。
 *  get/all → Row | Row[] | 解析函数；run → RunResult（或抛错，用于模拟约束冲突）。 */
export type RecordedMatcher = [
  sqlSnippet: string,
  method: "get" | "all" | "run",
  result: Row | Row[] | MatcherResolver | RunResult | RunResolver,
]

export interface MockDbLog {
  /** 所有 prepare 过的语句文本，按调用顺序 */
  prepared: string[]
  get: Array<{ sql: string; args: unknown[] }>
  all: Array<{ sql: string; args: unknown[] }>
  run: Array<{ sql: string; args: unknown[] }>
}

export interface RecordingMockDb {
  db: FakeDb
  log: MockDbLog
  /** prepare 过的语句里包含该片段的所有语句文本 */
  sqlContaining(snippet: string): string[]
  /** run() 里语句包含该片段的所有调用（含实参） */
  runsMatching(snippet: string): Array<{ sql: string; args: unknown[] }>
}

const DEFAULT_RUN: RunResult = { changes: 1, lastInsertRowid: 1 }

export function buildRecordingMockDb(
  matchers: RecordedMatcher[],
  opts: { runResult?: RunResult | RunResolver } = {},
): RecordingMockDb {
  const log: MockDbLog = { prepared: [], get: [], all: [], run: [] }

  const prepare = vi.fn((sql: string) => {
    log.prepared.push(sql)
    const matched = matchers.find(([snippet]) => sql.includes(snippet))
    const method = matched?.[1]
    const source = matched?.[2]

    const resolved = (args: unknown[]): Row | Row[] | undefined => {
      if (source === undefined || method === "run") return undefined
      return typeof source === "function"
        ? (source as MatcherResolver)(sql, args)
        : (source as Row | Row[])
    }

    const runResultFor = (args: unknown[]): RunResult => {
      if (method === "run" && source !== undefined) {
        return typeof source === "function" ? (source as RunResolver)(sql, args) : (source as RunResult)
      }
      if (opts.runResult !== undefined) {
        return typeof opts.runResult === "function" ? opts.runResult(sql, args) : opts.runResult
      }
      return DEFAULT_RUN
    }

    const statement = {
      get: vi.fn((...args: unknown[]) => {
        log.get.push({ sql, args })
        if (method === "all" || method === "run") return null
        const r = resolved(args)
        if (r === undefined) return null
        return Array.isArray(r) ? (r[0] ?? null) : r
      }),
      all: vi.fn((...args: unknown[]) => {
        log.all.push({ sql, args })
        if (method !== "all") return []
        const r = resolved(args)
        if (r === undefined) return []
        return Array.isArray(r) ? r : [r]
      }),
      run: vi.fn((...args: unknown[]) => {
        log.run.push({ sql, args })
        const r = runResultFor(args)
        return { changes: r.changes ?? 1, lastInsertRowid: r.lastInsertRowid ?? 1 }
      }),
    }

    return statement as unknown as FakeStatement
  })

  return {
    db: { prepare, pragma: vi.fn(() => []), close: vi.fn() } as unknown as FakeDb,
    log,
    sqlContaining: (snippet) => log.prepared.filter((s) => s.includes(snippet)),
    runsMatching: (snippet) => log.run.filter((c) => c.sql.includes(snippet)),
  }
}
