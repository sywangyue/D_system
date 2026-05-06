import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  // 1. Auth check
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. RBAC — admin only
  const role: string = (user.app_metadata as Record<string, unknown>)?.role as string || "readonly";
  if (role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 3. List users via admin API (requires service_role)
  const adminClient = await createAdminClient();

  const { data, error } = await adminClient.auth.admin.listUsers();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (data?.users || []).map((u) => ({
    id: u.id,
    email: u.email,
    role: (u.app_metadata as Record<string, unknown>)?.role || "readonly",
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
    confirmed_at: u.email_confirmed_at,
  }));

  return NextResponse.json({ users, total: users.length });
}
