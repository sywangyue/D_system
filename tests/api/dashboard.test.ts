import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers before importing the route
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn(() => {
      const chain: Record<string, any> = {
        _data: [] as any[],
        _error: null,
        select() { return chain; },
        eq() { return chain; },
        in() { return chain; },
        order() { return chain; },
        single() { return chain; },
        then(resolve: any) {
          return Promise.resolve(
            resolve({ data: chain._data, error: chain._error }),
          );
        },
      };
      return chain;
    }),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  })),
}));

import { GET } from "@/app/api/dashboard/route";

describe("GET /api/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return valid JSON with no filters", async () => {
    const req = new Request("http://localhost:3000/api/dashboard");
    const res = await GET(req);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("kpis");
    expect(body).toHaveProperty("brands");
    expect(body).toHaveProperty("industryDistribution");
    expect(body.brands).toEqual([]);
    expect(body.industryDistribution).toEqual([]);
  });

  it("should handle industry_l2 filter param", async () => {
    const req = new Request("http://localhost:3000/api/dashboard?industry_l2=医疗健康");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("kpis");
  });

  it("should handle competition_relation multi-select param", async () => {
    const req = new Request("http://localhost:3000/api/dashboard?competition_relation=是,否");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("should handle mds_related filter param", async () => {
    const req = new Request("http://localhost:3000/api/dashboard?mds_related=MFC");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("should handle all filters combined", async () => {
    const req = new Request(
      "http://localhost:3000/api/dashboard?industry_l2=医疗健康&competition_relation=是&mds_related=MFC",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
