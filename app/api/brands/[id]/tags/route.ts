import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TAG_FIELDS, type TagUpdateRequest } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. RBAC — readonly cannot tag
  const role: string = (user.app_metadata as Record<string, unknown>)?.role as string || "readonly";
  if (role === "readonly") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. Parse body
  let body: TagUpdateRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 4. Validate only allowed tag fields
  const entries = Object.entries(body).filter(
    ([, v]) => v !== undefined && v !== null,
  );
  const invalidFields = entries
    .filter(([k]) => !(TAG_FIELDS as readonly string[]).includes(k))
    .map(([k]) => k);

  if (invalidFields.length > 0) {
    return NextResponse.json(
      { error: `不可打标字段: ${invalidFields.join(", ")}` },
      { status: 422 },
    );
  }

  if (entries.length === 0) {
    return NextResponse.json({ error: "No valid tag fields provided" }, { status: 400 });
  }

  // 5. Check brand exists
  const brandResult = (await supabase
    .from("exhibition_brand")
    .select("*")
    .eq("brand_id", id)
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null };

  if (brandResult.error || !brandResult.data) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const brand = brandResult.data;
  const changedBy = user.email || user.id;

  // 6. Update each field + write history
  for (const [field, newValue] of entries) {
    const oldValue = brand[field] ?? "";

    await supabase
      .from("exhibition_brand")
      .update({ [field]: newValue, updated_at: new Date().toISOString() })
      .eq("brand_id", id);

    await supabase.from("manual_tag_history").insert({
      brand_id: id,
      field_name: field,
      old_value: String(oldValue),
      new_value: String(newValue),
      changed_by: changedBy,
      reason: "",
    });
  }

  // 7. Return updated brand
  const updated = (await supabase
    .from("exhibition_brand")
    .select("*")
    .eq("brand_id", id)
    .single()) as { data: Record<string, unknown> | null; error: { message: string } | null };

  return NextResponse.json({ brand: updated.data });
}
