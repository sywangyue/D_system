import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock state ─────────────────────────────────────────────────────────
let mockUser: { email: string; app_metadata: { role: string } } | null = {
  email: "admin@mwlab.internal",
  app_metadata: { role: "admin" },
};
let mockBrandCount = 3400;
let mockEditionCount = 12000;
let mockCrawlData = {
  started_at: "2026-05-05T08:00:00Z",
  finished_at: "2026-05-05T08:15:00Z",
  status: "success",
};

function resetMockState() {
  mockUser = {
    email: "admin@mwlab.internal",
    app_metadata: { role: "admin" },
  };
  mockBrandCount = 3400;
  mockEditionCount = 12000;
  mockCrawlData = {
    started_at: "2026-05-05T08:00:00Z",
    finished_at: "2026-05-05T08:15:00Z",
    status: "success",
  };
}

// ── Mocks ──────────────────────────────────────────────────────────────
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: vi.fn(() => []),
      set: vi.fn(),
    }),
  ),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => {
    function buildChain(table: string, args: unknown[]) {
      const chain: Record<string, unknown> = {
        _table: table,
        _args: args,
        select() {
          return chain;
        },
        order() {
          return chain;
        },
        limit() {
          return chain;
        },
        then(resolve: (result: unknown) => Promise<unknown>) {
          if (table === "crawl_log") {
            return Promise.resolve(
              resolve({ data: [mockCrawlData], error: null }),
            );
          }
          if (table === "exhibition_brand") {
            return Promise.resolve(
              resolve({ count: mockBrandCount, error: null }),
            );
          }
          if (table === "exhibition_edition") {
            return Promise.resolve(
              resolve({ count: mockEditionCount, error: null }),
            );
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        },
      };
      return chain;
    }

    return {
      from: vi.fn((table: string, args?: unknown) => buildChain(table, args ? [args] : [])),
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({
            data: { user: mockUser },
            error: mockUser ? null : { message: "Not authenticated" },
          }),
        ),
      },
    };
  }),
}));

// ── Import after mocks ─────────────────────────────────────────────────
import { GET } from "@/app/api/setting/status/route";

describe("GET /api/setting/status", () => {
  beforeEach(() => {
    resetMockState();
  });

  it("should return data_status and system_info for admin", async () => {
    const req = new Request("http://localhost:3000/api/setting/status");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("data_status");
    expect(json).toHaveProperty("system_info");
    expect(json.data_status.total_brands).toBe(3400);
    expect(json.data_status.total_editions).toBe(12000);
    expect(json.data_status.last_crawl_status).toBe("success");
    expect(json.data_status.last_crawl_started_at).toBe("2026-05-05T08:00:00Z");
    expect(json.system_info).toHaveProperty("node_version");
    expect(json.system_info).toHaveProperty("next_version");
  });

  it("should return 401 without valid session", async () => {
    mockUser = null;

    const req = new Request("http://localhost:3000/api/setting/status");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("should return 403 for manager role", async () => {
    mockUser = {
      email: "manager@mwlab.internal",
      app_metadata: { role: "manager" },
    };

    const req = new Request("http://localhost:3000/api/setting/status");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("should return 403 for readonly role", async () => {
    mockUser = {
      email: "readonly@mwlab.internal",
      app_metadata: { role: "readonly" },
    };

    const req = new Request("http://localhost:3000/api/setting/status");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("should handle null crawl data gracefully", async () => {
    mockCrawlData = null as unknown as typeof mockCrawlData;

    const req = new Request("http://localhost:3000/api/setting/status");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data_status.last_crawl_status).toBeNull();
    expect(json.data_status.last_crawl_started_at).toBeNull();
  });

  it("should include system_info properties", async () => {
    const req = new Request("http://localhost:3000/api/setting/status");
    const res = await GET(req);
    const json = await res.json();

    expect(json.system_info).toHaveProperty("supabase_project_ref");
    expect(json.system_info).toHaveProperty("build_time");
  });
});
