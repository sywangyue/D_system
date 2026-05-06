import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const industry_l2 = searchParams.get("industry_l2");
  const competition_relation = searchParams.get("competition_relation");
  const mds_related = searchParams.get("mds_related");

  const supabase = await createClient();

  let brandQuery = supabase.from("exhibition_brand").select("*");

  if (industry_l2) {
    brandQuery = brandQuery.eq("industry_l2", industry_l2);
  }
  if (competition_relation) {
    const relations = competition_relation.split(",").filter(Boolean);
    if (relations.length > 0) {
      brandQuery = brandQuery.in("competition_relation", relations);
    }
  }
  if (mds_related) {
    brandQuery = brandQuery.in("mds_related", [mds_related]);
  }

  const { data, error } = (await brandQuery) as {
    data: Brand[] | null;
    error: { message: string } | null;
  };
  const brands = data;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!brands || brands.length === 0) {
    return NextResponse.json({
      kpis: { total_area: 0, total_exhibitors: 0, total_visitors: 0, total_organizers: 0 },
      brands: [],
      industryDistribution: [],
    });
  }

  const brandIds = brands.map((b) => b.brand_id);

  const { data: editions, error: editionsError } = (await supabase
    .from("exhibition_edition")
    .select("area_sqm, exhibitors_count, visitors_count")
    .in("brand_id", brandIds)) as {
    data: ({ area_sqm: number | null; exhibitors_count: number | null; visitors_count: number | null })[] | null;
    error: { message: string } | null;
  };

  if (editionsError) {
    return NextResponse.json({ error: editionsError.message }, { status: 500 });
  }

  const kpis = {
    total_area: (editions || []).reduce((sum, e) => sum + (e.area_sqm || 0), 0),
    total_exhibitors: (editions || []).reduce((sum, e) => sum + (e.exhibitors_count || 0), 0),
    total_visitors: (editions || []).reduce((sum, e) => sum + (e.visitors_count || 0), 0),
    total_organizers: new Set(brands.map((b) => b.organizer).filter(Boolean)).size,
  };

  const distMap = new Map<string, number>();
  brands.forEach((b) => {
    const key = b.industry_l2 || "未分类";
    distMap.set(key, (distMap.get(key) || 0) + 1);
  });
  const industryDistribution = Array.from(distMap.entries()).map(
    ([name, value]) => ({ name, value }),
  );

  return NextResponse.json({ kpis, brands, industryDistribution });
}
