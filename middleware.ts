import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request);

  const protectedPaths = ["/dashboard", "/calendar", "/map", "/setting"];
  const { pathname } = request.nextUrl;

  if (protectedPaths.some((p) => pathname.startsWith(p)) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
