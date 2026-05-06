import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role: string =
    (user.app_metadata as Record<string, unknown>)?.role as string || "readonly";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ count: brandCount, error: brandErr }, { count: editionCount, error: editionErr }, { data: crawlData, error: crawlErr }] =
    await Promise.all([
      supabase
        .from("exhibition_brand")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("exhibition_edition")
        .select("*", { count: "exact", head: true }),
      supabase
        .from("crawl_log")
        .select("started_at, finished_at, status")
        .order("started_at", { ascending: false })
        .limit(1),
    ]);

  const lastCrawl = crawlData?.[0] ?? null;

  return NextResponse.json({
    data_status: {
      total_brands: brandCount ?? 0,
      total_editions: editionCount ?? 0,
      last_crawl_started_at: lastCrawl?.started_at ?? null,
      last_crawl_finished_at: lastCrawl?.finished_at ?? null,
      last_crawl_status: lastCrawl?.status ?? null,
    },
    system_info: {
      node_version: process.version,
      next_version: process.env.__NEXT_VERSION__ || "16.x",
      supabase_project_ref:
        process.env.NEXT_PUBLIC_SUPABASE_URL
          ?.replace("https://", "")
          .replace(".supabase.co", "") || "未配置",
      build_time: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
    },
    errors: {
      brand: brandErr?.message ?? null,
      edition: editionErr?.message ?? null,
      crawl: crawlErr?.message ?? null,
    },
  });
}
