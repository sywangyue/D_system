import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock state ─────────────────────────────────────────────────────────
let mockUser: { email: string; app_metadata: { role: string } } | null = {
  email: "admin@mwlab.internal",
  app_metadata: { role: "admin" },
};
const mockUsers = [
  {
    id: "user-1",
    email: "admin@mwlab.internal",
    app_metadata: { role: "admin" },
    last_sign_in_at: "2026-05-06T10:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    email_confirmed_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "user-2",
    email: "manager@mwlab.internal",
    app_metadata: { role: "manager" },
    last_sign_in_at: "2026-05-05T08:00:00Z",
    created_at: "2026-02-01T00:00:00Z",
    email_confirmed_at: "2026-02-01T00:00:00Z",
  },
];

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
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => {
      const chain: Record<string, unknown> = {
        select() { return chain; },
        eq() { return chain; },
        order() { return chain; },
        single() { return chain; },
        then(resolve: (result: unknown) => Promise<unknown>) {
          return Promise.resolve(resolve({ data: null, error: null }));
        },
      };
      return chain;
    }),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: { user: mockUser },
          error: mockUser ? null : { message: "Not authenticated" },
        }),
      ),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        admin: {
          listUsers: vi.fn(() =>
            Promise.resolve({
              data: { users: mockUsers },
              error: null,
            }),
          ),
        },
      },
    }),
  ),
}));

// ── Import after mocks ─────────────────────────────────────────────────
import { GET } from "@/app/api/users/route";

describe("GET /api/users", () => {
  function resetMockState() {
    mockUser = {
      email: "admin@mwlab.internal",
      app_metadata: { role: "admin" },
    };
  }

  beforeEach(() => {
    resetMockState();
  });

  it("should return user list for admin", async () => {
    const req = new Request("http://localhost:3000/api/users");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("users");
    expect(json).toHaveProperty("total");
    expect(json.users).toHaveLength(2);
    expect(json.total).toBe(2);
    expect(json.users[0]).toHaveProperty("email");
    expect(json.users[0]).toHaveProperty("role");
  });

  it("should return 401 without valid session", async () => {
    mockUser = null;

    const req = new Request("http://localhost:3000/api/users");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("should return 403 for non-admin role", async () => {
    mockUser = {
      email: "manager@mwlab.internal",
      app_metadata: { role: "manager" },
    };

    const req = new Request("http://localhost:3000/api/users");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("should return 403 for readonly role", async () => {
    mockUser = {
      email: "readonly@mwlab.internal",
      app_metadata: { role: "readonly" },
    };

    const req = new Request("http://localhost:3000/api/users");
    const res = await GET(req);

    expect(res.status).toBe(403);
  });
});
