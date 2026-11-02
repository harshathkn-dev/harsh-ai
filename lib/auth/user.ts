import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  const email =
    typeof data?.claims?.email === "string" ? data.claims.email : null;

  if (error || !userId) {
    return null;
  }

  return { supabase, userId, email };
}

export async function requireAuthenticatedUser() {
  const context = await getAuthenticatedUser();

  if (!context) {
    redirect("/login");
  }

  return context;
}
