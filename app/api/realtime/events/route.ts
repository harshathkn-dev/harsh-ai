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
  const usage = parsed.data.usage;
  if (usage.type === "duration" && !isTranscription) {
    return jsonError(
      400,
      "INVALID_USAGE",
      "Duration usage is only valid for transcription.",
    );
  }

  const pendingTranscriptionCost: {
    estimatedCostUsd: number;
    costStatus: "pending_transcription_pricing";
  } = {
    estimatedCostUsd: 0,
    costStatus: "pending_transcription_pricing",
  };
  const usageValues =
    usage.type === "duration"
      ? {
          inputTokens: 0,
          outputTokens: 0,
          audioSeconds: usage.seconds,
          inputAudioTokens: 0,
          outputAudioTokens: 0,
          inputTokenDetails: {},
          outputTokenDetails: {},
          cost: pendingTranscriptionCost,
        }
      : {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
          audioSeconds: 0,
          inputAudioTokens: usage.input_token_details?.audio_tokens ?? 0,
          outputAudioTokens: usage.output_token_details?.audio_tokens ?? 0,
          inputTokenDetails: usage.input_token_details ?? {},
          outputTokenDetails: usage.output_token_details ?? {},
          cost: isTranscription
            ? pendingTranscriptionCost
            : calculateRealtimeCost(usage),
        };

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
      input_tokens: usageValues.inputTokens,
      output_tokens: usageValues.outputTokens,
      audio_seconds: usageValues.audioSeconds,
      estimated_cost_usd: usageValues.cost.estimatedCostUsd,
      request_id: parsed.data.responseId,
      metadata: {
        source: isTranscription
          ? "openai_realtime_transcription_completed"
          : "openai_realtime_response_done",
        connection_id: connection.id,
        cost_status: usageValues.cost.costStatus,
        input_audio_tokens: usageValues.inputAudioTokens,
        output_audio_tokens: usageValues.outputAudioTokens,
        input_token_details: usageValues.inputTokenDetails,
        output_token_details: usageValues.outputTokenDetails,
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
    costStatus: usageValues.cost.costStatus,
  });
}
