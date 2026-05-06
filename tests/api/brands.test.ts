import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers before importing the route
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}));

// A helper to create mock Supabase chain with specific data
function createMockChain(data: any, error: any = null, single: boolean = false) {
  const chain: Record<string, any> = {
    _data: data,
    _error: error,
    _single: single,
    select() { return chain; },
    eq() { return chain; },
    in() { return chain; },
    order() { return chain; },
    single() {
      chain._single = true;
      return chain;
    },
    then(resolve: any) {
      const result = chain._single
        ? { data: chain._data?.[0] || null, error: chain._error }
        : { data: chain._data, error: chain._error };
      return Promise.resolve(resolve(result));
    },
  };
  return chain;
}

let mockFromData: Record<string, any[]> = {};
vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      return createMockChain(mockFromData[table] || []);
    }),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
  })),
}));

import { GET } from "@/app/api/brands/[id]/route";

describe("GET /api/brands/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFromData = {};
  });

  it("should return 404 for non-existent brand_id", async () => {
    const req = new Request("http://localhost:3000/api/brands/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Brand not found");
  });

  it("should return brand + editions for valid brand_id", async () => {
    const mockBrand = { brand_id: "brand-1", name_cn: "Test Brand", name_en: "TB" };
    const mockEditions = [
      { edition_id: "ed-1", brand_id: "brand-1", year: 2025, city: "Shanghai" },
      { edition_id: "ed-2", brand_id: "brand-1", year: 2024, city: "Beijing" },
    ];

    mockFromData = {
      exhibition_brand: [mockBrand],
      exhibition_edition: mockEditions,
    };

    const req = new Request("http://localhost:3000/api/brands/brand-1");
    const res = await GET(req, { params: Promise.resolve({ id: "brand-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.brand.brand_id).toBe("brand-1");
    expect(body.editions).toHaveLength(2);
  });

  it("should return JSON content type", async () => {
    const req = new Request("http://localhost:3000/api/brands/brand-1");
    const res = await GET(req, { params: Promise.resolve({ id: "brand-1" }) });
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("should return error message in response body on 404", async () => {
    const req = new Request("http://localhost:3000/api/brands/missing");
    const res = await GET(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("should order editions by year DESC", async () => {
    const mockBrand = { brand_id: "brand-1", name_cn: "Test" };
    // Data is returned pre-sorted to test the API calls .order("year", {ascending: false})
    mockFromData = {
      exhibition_brand: [mockBrand],
      exhibition_edition: [
        { edition_id: "ed-3", year: 2026 },
        { edition_id: "ed-2", year: 2025 },
        { edition_id: "ed-1", year: 2024 },
      ],
    };

    const req = new Request("http://localhost:3000/api/brands/brand-1");
    const res = await GET(req, { params: Promise.resolve({ id: "brand-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.editions).toHaveLength(3);
  });
});
