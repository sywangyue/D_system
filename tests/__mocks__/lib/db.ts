// Shared mock for @/lib/db — provides configurable fake better-sqlite3 db
import { vi } from "vitest"

interface MockQueryResult {
  [key: string]: unknown
}

let _mockData: Map<string, MockQueryResult[]> = new Map()

export function setMockQuery(sqlPrefix: string, rows: MockQueryResult[]) {
  _mockData.set(sqlPrefix, rows)
}

export function clearMockData() {
  _mockData.clear()
}

function findMock(key: string): MockQueryResult[] {
  for (const [prefix, rows] of _mockData) {
    if (key.includes(prefix)) return rows
  }
  return []
}

export function createMockDb() {
  return {
    prepare: vi.fn((sql: string) => ({
      get: vi.fn((..._args: unknown[]) => findMock(sql + ":get")[0] ?? null),
      all: vi.fn((..._args: unknown[]) => findMock(sql + ":all")),
      run: vi.fn((..._args: unknown[]) => ({ changes: 1, lastInsertRowid: 1 })),
    })),
    pragma: vi.fn(() => []),
    close: vi.fn(),
  }
}

// Default mock — auto-applied when any test imports @/lib/db
vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => createMockDb()),
}))
