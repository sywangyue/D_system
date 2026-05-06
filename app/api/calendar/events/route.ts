import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request) {
  const supabase = await createClient();

  const result = (await supabase
    .from("exhibition_edition")
    .select("edition_id, date_start, date_end, venue, city, exhibitors_count, brand_id, exhibition_brand(name_cn, competition_relation)")
    .not("date_start", "is", null)
    .order("date_start", { ascending: true })) as {
    data: {
      edition_id: string;
      date_start: string;
      date_end: string | null;
      venue: string;
      city: string;
      exhibitors_count: number | null;
      brand_id: string;
      exhibition_brand: { name_cn: string; competition_relation: string } | null;
    }[] | null;
    error: { message: string } | null;
  };

  const { data: editions, error } = result;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (editions || []).map((ed) => ({
    edition_id: ed.edition_id,
    name_cn: ed.exhibition_brand?.name_cn || "未知展会",
    date_start: ed.date_start,
    date_end: ed.date_end,
    venue: ed.venue,
    city: ed.city,
    exhibitors_count: ed.exhibitors_count,
    competition_relation: ed.exhibition_brand?.competition_relation || "",
  }));

  return NextResponse.json({ events });
}
