import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/user";
import { realtimeEndSchema } from "@/lib/realtime/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json(
      { error: "Authentication is required.", code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  const parsed = realtimeEndSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid end-session request.", code: "INVALID_REQUEST" },
      { status: 400 },
    );
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json(
      { error: "Server-side persistence is not configured." },
      { status: 503 },
    );
  }

  const { data: connection } = await admin
    .from("realtime_connections")
    .select("id, session_id, model, status, started_at, ended_at")
    .eq("id", parsed.data.connectionId)
    .eq("session_id", parsed.data.sessionId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json(
      { error: "Realtime connection not found.", code: "CONNECTION_NOT_FOUND" },
      { status: 404 },
    );
  }

  const alreadyEnded =
    connection.status === "ended" || connection.status === "failed";
  const endedAt =
    alreadyEnded && connection.ended_at
      ? new Date(connection.ended_at)
      : new Date();
  const durationSeconds = Math.max(
    0,
    (endedAt.getTime() - new Date(connection.started_at).getTime()) / 1000,
  );
  const status = parsed.data.errorCode ? "failed" : "ended";

  if (!alreadyEnded) {
    const { error: updateError } = await admin
      .from("realtime_connections")
      .update({
        status,
        ended_at: endedAt.toISOString(),
        last_error_code: parsed.data.errorCode ?? null,
        metadata: { session_duration_seconds: durationSeconds },
      })
      .eq("id", connection.id)
      .in("status", ["connecting", "connected"]);

    if (updateError) {
      return NextResponse.json(
        { error: "Realtime connection could not be closed." },
        { status: 500 },
      );
    }
  }

  await admin.from("usage_events").upsert(
    {
      user_id: auth.userId,
      session_id: connection.session_id,
      feature: "realtime_voice_session",
      provider: "openai",
      model: connection.model,
      input_tokens: 0,
      output_tokens: 0,
      audio_seconds: 0,
      estimated_cost_usd: 0,
      request_id: `realtime-call:${connection.id}`,
      metadata: {
        source: "realtime_connection_elapsed_time",
        session_duration_seconds: durationSeconds,
        cost_status: "not_applicable_duration_record",
      },
    },
    { onConflict: "user_id,provider,request_id" },
  );

  return NextResponse.json({ ended: true, durationSeconds });
}
