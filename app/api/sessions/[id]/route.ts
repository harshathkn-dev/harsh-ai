import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/user";
import {
  updateSessionSchema,
  validationMessage,
} from "@/lib/sessions/validation";

type SessionRouteProps = {
  params: Promise<{ id: string }>;
};

const sessionSelection =
  "id, title, session_type, status, started_at, ended_at, metadata, created_at, updated_at";

async function routeContext(params: Promise<{ id: string }>) {
  const [{ id }, auth] = await Promise.all([params, getAuthenticatedUser()]);
  const parsedId = z.string().uuid().safeParse(id);
  return { auth, id: parsedId.success ? parsedId.data : null };
}

export async function GET(_: Request, { params }: SessionRouteProps) {
  const { auth, id } = await routeContext(params);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
  }

  const { data: session, error } = await auth.supabase
    .from("sessions")
    .select(sessionSelection)
    .eq("id", id)
    .maybeSingle();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const [messages, transcripts, notes] = await Promise.all([
    auth.supabase
      .from("session_messages")
      .select("id, role, content, model, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: true }),
    auth.supabase
      .from("transcripts")
      .select(
        "id, transcript_text, language, duration_seconds, status, created_at",
      )
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
    auth.supabase
      .from("ai_notes")
      .select("id, note_type, title, content, model, created_at")
      .eq("session_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (messages.error || transcripts.error || notes.error) {
    return NextResponse.json(
      { error: "Some session content could not be loaded." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    session,
    messages: messages.data ?? [],
    transcripts: transcripts.data ?? [],
    notes: notes.data ?? [],
  });
}

export async function PATCH(request: Request, { params }: SessionRouteProps) {
  const { auth, id } = await routeContext(params);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = updateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: validationMessage(parsed.error) },
      { status: 400 },
    );
  }

  const { data: existing, error: loadError } = await auth.supabase
    .from("sessions")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const updates: Record<string, string> = {};

  if (parsed.data.title !== undefined) {
    updates.title = parsed.data.title;
  }

  if (parsed.data.sessionType !== undefined) {
    updates.session_type = parsed.data.sessionType;
  }

  if (parsed.data.action === "start") {
    if (existing.status !== "draft") {
      return NextResponse.json(
        { error: "Only draft sessions can be started." },
        { status: 409 },
      );
    }
    updates.status = "active";
    updates.started_at = new Date().toISOString();
  }

  if (parsed.data.action === "stop") {
    if (existing.status !== "active") {
      return NextResponse.json(
        { error: "Only active sessions can be completed." },
        { status: 409 },
      );
    }
    updates.status = "completed";
    updates.ended_at = new Date().toISOString();
  }

  if (parsed.data.action === "archive") {
    if (existing.status !== "completed") {
      return NextResponse.json(
        { error: "Only completed sessions can be archived." },
        { status: 409 },
      );
    }
    updates.status = "archived";
  }

  const { data, error } = await auth.supabase
    .from("sessions")
    .update(updates)
    .eq("id", id)
    .eq("status", existing.status)
    .select(sessionSelection)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Session could not be updated." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "The session changed before this request completed. Refresh and try again." },
      { status: 409 },
    );
  }

  return NextResponse.json({ session: data });
}

export async function DELETE(_: Request, { params }: SessionRouteProps) {
  const { auth, id } = await routeContext(params);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!id) {
    return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("sessions")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Session could not be deleted." },
      { status: 500 },
    );
  }

  if (!data) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return new NextResponse(null, { status: 204 });
}
