import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock state ─────────────────────────────────────────────────────────
let mockUser: { email: string; app_metadata: { role: string } } | null = {
  email: "admin@mwlab.internal",
  app_metadata: { role: "admin" },
};
let mockBrand: Record<string, unknown> | null = {
  brand_id: "brand-1",
  name_cn: "测试展会",
  industry_l1: "工业",
  industry_l2: "自动化",
  competition_relation: "是",
  mds_related: "MFC",
};
let insertedHistory: Record<string, unknown>[] = [];
let updatedBrand: Record<string, unknown> | null = null;

function resetMockState() {
  mockUser = {
    email: "admin@mwlab.internal",
    app_metadata: { role: "admin" },
  };
  mockBrand = {
    brand_id: "brand-1",
    name_cn: "测试展会",
    industry_l1: "工业",
    industry_l2: "自动化",
    competition_relation: "是",
    mds_related: "MFC",
  };
  insertedHistory = [];
  updatedBrand = { ...mockBrand };
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
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {
        _table: table,
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        order() {
          return chain;
        },
        single() {
          return chain;
        },
        update(data: Record<string, unknown>) {
          if (table === "exhibition_brand") {
            updatedBrand = { ...updatedBrand, ...data };
          }
          return chain;
        },
        insert(data: Record<string, unknown> | Record<string, unknown>[]) {
          if (table === "manual_tag_history") {
            const items = Array.isArray(data) ? data : [data];
            insertedHistory.push(...items);
          }
          return chain;
        },
        then(resolve: (result: unknown) => Promise<unknown>) {
          if (chain._table === "manual_tag_history" && insertedHistory.length > 0) {
            return Promise.resolve(resolve({ data: insertedHistory, error: null }));
          }
          if (chain._table === "exhibition_brand") {
            return Promise.resolve(
              resolve({ data: mockBrand, error: null }),
            );
          }
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

// ── Import after mocks ─────────────────────────────────────────────────
import { PATCH } from "@/app/api/brands/[id]/tags/route";

describe("PATCH /api/brands/[id]/tags", () => {
  beforeEach(() => {
    resetMockState();
  });

  it("should accept valid tag fields and return updated brand", async () => {
    const body = JSON.stringify({
      industry_l1: "医疗健康",
      competition_relation: "否",
    });
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body,
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "brand-1" }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toHaveProperty("brand");
    expect(json.brand).toBeDefined();
  });

  it("should reject invalid tag fields", async () => {
    const body = JSON.stringify({
      name_cn: "hacked", // not in TAG_FIELDS
      competition_relation: "否",
    });
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body,
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "brand-1" }),
    });

    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toContain("不可打标字段");
  });

  it("should write old→new values to manual_tag_history", async () => {
    const body = JSON.stringify({ competition_relation: "否" });
    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body,
    });
    await PATCH(req, { params: Promise.resolve({ id: "brand-1" }) });

    expect(insertedHistory.length).toBeGreaterThanOrEqual(1);
    expect(insertedHistory[0]).toMatchObject({
      brand_id: "brand-1",
      field_name: "competition_relation",
      old_value: "是",
      new_value: "否",
    });
  });

  it("should return 401 without valid session", async () => {
    mockUser = null;

    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body: JSON.stringify({ competition_relation: "否" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "brand-1" }),
    });

    expect(res.status).toBe(401);
  });

  it("should return 403 for readonly role", async () => {
    mockUser = {
      email: "readonly@mwlab.internal",
      app_metadata: { role: "readonly" },
    };

    const req = new Request("http://localhost:3000/api/brands/brand-1/tags", {
      method: "PATCH",
      body: JSON.stringify({ competition_relation: "否" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "brand-1" }),
    });

    expect(res.status).toBe(403);
  });

  it("should return 404 for non-existent brand", async () => {
    mockBrand = null;

    const req = new Request("http://localhost:3000/api/brands/nonexistent/tags", {
      method: "PATCH",
      body: JSON.stringify({ competition_relation: "否" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });

    expect(res.status).toBe(404);
  });
});
