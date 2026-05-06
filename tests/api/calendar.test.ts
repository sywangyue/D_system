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

import { GET } from "@/app/api/calendar/events/route";

describe("GET /api/calendar/events", () => {
  beforeEach(() => {
    resetMockState();
  });

  it("should return valid JSON with events array", async () => {
    const req = new Request("http://localhost:3000/api/calendar/events");
    const res = await GET(req);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("events");
    expect(Array.isArray(body.events)).toBe(true);
  });

  it("should return empty events array when no editions have dates", async () => {
    const req = new Request("http://localhost:3000/api/calendar/events");
    const res = await GET(req);
    const body = await res.json();
    expect(body.events).toEqual([]);
  });

  it("should return 200 status on success", async () => {
    const req = new Request("http://localhost:3000/api/calendar/events");
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("should map edition fields to event shape when data exists", async () => {
    mockEditions = [
      {
        edition_id: "ed-001",
        date_start: "2026-06-15",
        date_end: "2026-06-18",
        venue: "国家会展中心",
        city: "上海",
        exhibitors_count: 500,
        brand_id: "b-001",
        exhibition_brand: {
          name_cn: "上海国际医疗展",
          competition_relation: "竞争对手",
        },
      },
    ];

    const req = new Request("http://localhost:3000/api/calendar/events");
    const res = await GET(req);
    const body = await res.json();
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      edition_id: "ed-001",
      name_cn: "上海国际医疗展",
      venue: "国家会展中心",
      city: "上海",
      exhibitors_count: 500,
      competition_relation: "竞争对手",
    });
  });

  it("should handle missing exhibition_brand gracefully", async () => {
    mockEditions = [
      {
        edition_id: "ed-002",
        date_start: "2026-07-01",
        date_end: null,
        venue: "深圳会展中心",
        city: "深圳",
        exhibitors_count: null,
        brand_id: "b-002",
        exhibition_brand: null,
      },
    ];

    const req = new Request("http://localhost:3000/api/calendar/events");
    const res = await GET(req);
    const body = await res.json();
    expect(body.events[0].name_cn).toBe("未知展会");
    expect(body.events[0].competition_relation).toBe("");
  });
});
