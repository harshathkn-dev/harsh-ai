import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

function safeNextPath(candidate: string | null): string {
  return candidate?.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(candidate)
    ? candidate
    : "/dashboard";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "error",
    "Authentication could not be completed. Please try again.",
  );
  return NextResponse.redirect(loginUrl);
}
