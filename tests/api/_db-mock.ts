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
