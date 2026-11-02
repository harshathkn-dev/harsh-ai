import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/user";
import {
  createSessionSchema,
  sessionListStatusSchema,
  validationMessage,
} from "@/lib/sessions/validation";

const sessionSelection =
  "id, title, session_type, status, started_at, ended_at, created_at, updated_at";

export async function GET(request: Request) {
  const context = await getAuthenticatedUser();

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const statusValue = new URL(request.url).searchParams.get("status");
  const parsedStatus = statusValue
    ? sessionListStatusSchema.safeParse(statusValue)
    : null;

  if (parsedStatus && !parsedStatus.success) {
    return NextResponse.json(
      { error: "Invalid session status filter." },
      { status: 400 },
    );
  }

  let query = context.supabase
    .from("sessions")
    .select(sessionSelection)
    .order("created_at", { ascending: false })
    .limit(100);

  if (parsedStatus?.success) {
    query = query.eq("status", parsedStatus.data);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Sessions could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json({ sessions: data });
}

export async function POST(request: Request) {
  const context = await getAuthenticatedUser();

  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = createSessionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { data, error } = await context.supabase
    .from("sessions")
    .insert({
      user_id: context.userId,
      title: parsed.data.title,
      session_type: parsed.data.sessionType,
      status: "draft",
    })
    .select(sessionSelection)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Session could not be created." },
      { status: 500 },
    );
  }

  return NextResponse.json({ session: data }, { status: 201 });
}
