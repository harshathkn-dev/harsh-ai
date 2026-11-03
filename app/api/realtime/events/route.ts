import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/user";
import { calculateRealtimeCost } from "@/lib/openai/realtime-cost";
import { realtimeEventSchema } from "@/lib/realtime/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function jsonError(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return jsonError(401, "UNAUTHORIZED", "Authentication is required.");
  }

  const parsed = realtimeEventSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return jsonError(400, "INVALID_EVENT", "Invalid Realtime event.");
  }

  const { data: session } = await auth.supabase
    .from("sessions")
    .select("id")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();
  if (!session) {
    return jsonError(404, "SESSION_NOT_FOUND", "Session not found.");
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return jsonError(
      503,
      "PERSISTENCE_NOT_CONFIGURED",
      "Server-side persistence is not configured.",
    );
  }

  const { data: connection } = await admin
    .from("realtime_connections")
    .select("id, model, status")
    .eq("id", parsed.data.connectionId)
    .eq("session_id", session.id)
    .eq("user_id", auth.userId)
    .eq("status", "connected")
    .maybeSingle();
  if (!connection) {
    return jsonError(
      403,
      "CONNECTION_NOT_AUTHORIZED",
      "Realtime connection is not authorized.",
    );
  }

  if (parsed.data.type === "message") {
    const { error } = await admin.from("session_messages").upsert(
      {
        session_id: session.id,
        user_id: auth.userId,
        role: parsed.data.role,
        content: parsed.data.text,
        model: parsed.data.role === "assistant" ? connection.model : null,
        provider_item_id: parsed.data.providerItemId,
        response_id: parsed.data.responseId ?? null,
        response_status: parsed.data.status,
        metadata: {
          source: "openai_realtime_webrtc",
          connection_id: connection.id,
        },
      },
      { onConflict: "session_id,provider_item_id" },
    );

    if (error) {
      console.error("Realtime message persistence failed", {
        code: error.code,
        sessionId: session.id,
        userId: auth.userId,
      });
      return jsonError(
        500,
        "MESSAGE_PERSISTENCE_FAILED",
        "The transcript could not be saved.",
      );
    }

    return NextResponse.json({ saved: true });
  }

  const isTranscription = parsed.data.usageKind === "transcription";
  const isDurationUsage = "seconds" in parsed.data.usage;
  if (isDurationUsage && !isTranscription) {
    return jsonError(
      400,
      "INVALID_USAGE",
      "Duration usage is only valid for transcription.",
    );
  }
  const cost = isTranscription || isDurationUsage
    ? {
        estimatedCostUsd: 0,
        costStatus: "pending_transcription_pricing" as const,
      }
    : calculateRealtimeCost(parsed.data.usage);
  const inputAudioTokens = isDurationUsage
    ? 0
    : (parsed.data.usage.input_token_details?.audio_tokens ?? 0);
  const outputAudioTokens = isDurationUsage
    ? 0
    : (parsed.data.usage.output_token_details?.audio_tokens ?? 0);
  const { error } = await admin.from("usage_events").upsert(
    {
      user_id: auth.userId,
      session_id: session.id,
      feature: isTranscription
        ? "realtime_voice_transcription"
        : "realtime_voice_response",
      provider: "openai",
      model: isTranscription
        ? process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ||
          "gpt-4o-mini-transcribe"
        : connection.model,
      input_tokens: isDurationUsage ? 0 : parsed.data.usage.input_tokens,
      output_tokens: isDurationUsage ? 0 : parsed.data.usage.output_tokens,
      audio_seconds: isDurationUsage ? parsed.data.usage.seconds : 0,
      estimated_cost_usd: cost.estimatedCostUsd,
      request_id: parsed.data.responseId,
      metadata: {
        source: isTranscription
          ? "openai_realtime_transcription_completed"
          : "openai_realtime_response_done",
        connection_id: connection.id,
        cost_status: cost.costStatus,
        input_audio_tokens: inputAudioTokens,
        output_audio_tokens: outputAudioTokens,
        input_token_details: isDurationUsage
          ? {}
          : (parsed.data.usage.input_token_details ?? {}),
        output_token_details: isDurationUsage
          ? {}
          : (parsed.data.usage.output_token_details ?? {}),
      },
    },
    { onConflict: "user_id,provider,request_id" },
  );

  if (error) {
    console.error("Realtime usage persistence failed", {
      code: error.code,
      sessionId: session.id,
      userId: auth.userId,
    });
    return jsonError(
      500,
      "USAGE_PERSISTENCE_FAILED",
      "Realtime usage could not be saved.",
    );
  }

  return NextResponse.json({
    saved: true,
    costStatus: cost.costStatus,
  });
}
