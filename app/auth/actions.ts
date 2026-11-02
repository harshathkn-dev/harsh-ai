"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function safeNextPath(candidate: string): string {
  return candidate.startsWith("/") &&
    !candidate.startsWith("//") &&
    !candidate.includes("\\") &&
    !/[\u0000-\u001f\u007f]/.test(candidate)
    ? candidate
    : "/dashboard";
}

async function applicationOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  const vercelHost =
    process.env.VERCEL_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;

  if (vercelHost) {
    return `https://${vercelHost.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  throw new Error(
    "NEXT_PUBLIC_APP_URL must be configured for authentication redirects.",
  );
}

function authRedirect(
  path: string,
  type: "error" | "message",
  text: string,
): never {
  redirect(`${path}?${type}=${encodeURIComponent(text)}`);
}

export async function signUp(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");

  if (!email || password.length < 8) {
    authRedirect(
      "/signup",
      "error",
      "Enter a valid email and a password of at least 8 characters.",
    );
  }

  const supabase = await createClient();
  const origin = await applicationOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/dashboard`,
    },
  });

  if (error) {
    authRedirect("/signup", "error", error.message);
  }

  if (data.session) {
    redirect("/dashboard");
  }

  authRedirect(
    "/login",
    "message",
    "Check your email to confirm your account before signing in.",
  );
}

export async function signIn(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const next = safeNextPath(value(formData, "next"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    authRedirect("/login", "error", "Invalid email or password.");
  }

  redirect(next);
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNextPath(value(formData, "next"));
  const origin = await applicationOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error || !data.url) {
    authRedirect(
      "/login",
      "error",
      error?.message ?? "Google sign-in is not configured.",
    );
  }

  redirect(data.url);
}

export async function requestPasswordReset(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const origin = await applicationOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
  });

  if (error) {
    authRedirect("/forgot-password", "error", error.message);
  }

  authRedirect(
    "/login",
    "message",
    "If that account exists, a password reset email has been sent.",
  );
}

export async function updatePassword(formData: FormData) {
  const password = value(formData, "password");

  if (password.length < 8) {
    authRedirect(
      "/auth/update-password",
      "error",
      "Password must contain at least 8 characters.",
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    authRedirect("/auth/update-password", "error", error.message);
  }

  authRedirect("/dashboard", "message", "Your password has been updated.");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}