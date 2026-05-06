import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Brand, Edition } from "@/lib/types";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const result = (await supabase
    .from("exhibition_brand")
    .select("*")
    .eq("brand_id", id)
    .single()) as { data: Brand | null; error: { message: string } | null };

  const { data: brand, error } = result;

  if (error || !brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const { data: editions, error: editionsError } = (await supabase
    .from("exhibition_edition")
    .select("*")
    .eq("brand_id", id)
    .order("year", { ascending: false })) as {
    data: Edition[] | null;
    error: { message: string } | null;
  };

  if (editionsError) {
    return NextResponse.json({ error: editionsError.message }, { status: 500 });
  }

  return NextResponse.json({ brand, editions });
}
