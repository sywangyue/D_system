import { describe, it, expect, vi, beforeEach } from "vitest";

let mockEditions: Record<string, unknown>[] = [];

function resetMockState() {
  mockEditions = [];
}

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
      const chain: Record<string, any> = {
        _data: mockEditions,
        _error: null,
        select() { return chain; },
        not() { return chain; },
        order() { return chain; },
        then(resolve: any) {
          return Promise.resolve(
            resolve({ data: chain._data, error: chain._error }),
          );
        },
      };
      return chain;
    }),
  })),
}));

import { GET } from "@/app/api/map/markers/route";

describe("GET /api/map/markers", () => {
  beforeEach(() => {
    resetMockState();
  });

  it("should return valid JSON with markers array", async () => {
    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await GET(req);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("markers");
    expect(Array.isArray(body.markers)).toBe(true);
  });

  it("should return empty markers array when no editions have cities", async () => {
    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await GET(req);
    const body = await res.json();
    expect(body.markers).toEqual([]);
  });

  it("should return 200 status on success", async () => {
    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("should aggregate editions by city", async () => {
    mockEditions = [
      {
        city: "上海",
        exhibitors_count: 500,
        brand_id: "b-001",
        exhibition_brand: { name_cn: "上海国际医疗展", is_international: 0 },
      },
      {
        city: "上海",
        exhibitors_count: 300,
        brand_id: "b-002",
        exhibition_brand: { name_cn: "上海电子展", is_international: 0 },
      },
      {
        city: "北京",
        exhibitors_count: 200,
        brand_id: "b-003",
        exhibition_brand: { name_cn: "北京健康展", is_international: 0 },
      },
    ];

    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await GET(req);
    const body = await res.json();

    const shanghai = body.markers.find((m: any) => m.city === "上海");
    const beijing = body.markers.find((m: any) => m.city === "北京");

    expect(shanghai.count).toBe(2);
    expect(shanghai.is_china).toBe(true);
    expect(shanghai.top_exhibitions).toContain("上海国际医疗展");
    expect(shanghai.top_exhibitions).toContain("上海电子展");
    expect(beijing.count).toBe(1);
  });

  it("should mark international cities correctly", async () => {
    mockEditions = [
      {
        city: "法兰克福",
        exhibitors_count: 800,
        brand_id: "b-004",
        exhibition_brand: { name_cn: "法兰克福汽车展", is_international: 1 },
      },
    ];

    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await GET(req);
    const body = await res.json();

    expect(body.markers[0].is_china).toBe(false);
  });

  it("should handle missing exhibition_brand gracefully", async () => {
    mockEditions = [
      {
        city: "深圳",
        exhibitors_count: null,
        brand_id: "b-005",
        exhibition_brand: null,
      },
    ];

    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await GET(req);
    const body = await res.json();

    expect(body.markers[0].city).toBe("深圳");
    expect(body.markers[0].count).toBe(1);
    expect(body.markers[0].top_exhibitions).toEqual([]);
    expect(body.markers[0].is_china).toBe(true);
  });

  it("should include lat/lng for known cities", async () => {
    mockEditions = [
      {
        city: "上海",
        exhibitors_count: 100,
        brand_id: "b-006",
        exhibition_brand: { name_cn: "上海展", is_international: 0 },
      },
    ];

    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await GET(req);
    const body = await res.json();

    expect(body.markers[0].lat).toBeCloseTo(31.23, 1);
    expect(body.markers[0].lng).toBeCloseTo(121.47, 1);
  });

  it("should return 500 on database error", async () => {
    vi.mocked((await import("@supabase/ssr")).createServerClient).mockReturnValueOnce({
      from: vi.fn(() => ({
        select() { return this; },
        not() { return this; },
        then(resolve: any) {
          return Promise.resolve(
            resolve({ data: null, error: { message: "DB connection failed" } }),
          );
        },
      })),
    } as any);

    const { GET: freshGet } = await import("@/app/api/map/markers/route");
    const req = new Request("http://localhost:3000/api/map/markers");
    const res = await freshGet(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("DB connection failed");
  });
});
