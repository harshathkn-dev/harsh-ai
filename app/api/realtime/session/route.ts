import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedUser } from "@/lib/auth/user";
import { getRealtimeConfig } from "@/lib/openai/realtime-config";
import {
  isRealtimeVoice,
  type RealtimeVoice,
} from "@/lib/realtime/types";
import { realtimeSessionRequestSchema } from "@/lib/realtime/validation";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const openAISecretSchema = z.object({
  value: z.string().min(1),
  expires_at: z.number(),
  session: z.object({
    id: z.string().min(1),
  }),
});

function instructionsFor(type: string, title: string) {
  const purpose =
    type === "interview"
      ? "Act as a thoughtful interview copilot. Answer clearly, ask useful follow-up questions, and help the user reason through interview topics."
      : type === "meeting"
        ? "Act as a concise meeting copilot. Help clarify ideas, decisions, and next actions without dominating the conversation."
        : "Act as a helpful conversational assistant. Be accurate, natural, and concise.";

  return `${purpose} This live conversation belongs to the session "${title}". Speak naturally. Do not claim to have performed actions you cannot perform.`;
}

function errorResponse(status: number, code: string, message: string) {
  return NextResponse.json({ error: message, code }, { status });
}

function openAIError(status: number, providerCode: string | undefined) {
  if (status === 401 || status === 403) {
    return errorResponse(
      502,
      "OPENAI_AUTHENTICATION_FAILED",
      "OpenAI authentication failed. Check the server API key.",
    );
  }
  if (status === 429) {
    return errorResponse(
      429,
      providerCode === "insufficient_quota"
        ? "OPENAI_QUOTA_EXCEEDED"
        : "OPENAI_RATE_LIMITED",
      providerCode === "insufficient_quota"
        ? "OpenAI quota or billing is unavailable for Realtime."
        : "OpenAI is rate limiting Realtime connections. Try again shortly.",
    );
  }
  return errorResponse(
    502,
    "OPENAI_REALTIME_UNAVAILABLE",
    "OpenAI Realtime is temporarily unavailable.",
  );
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return errorResponse(401, "UNAUTHORIZED", "Authentication is required.");
  }

  const parsed = realtimeSessionRequestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return errorResponse(400, "INVALID_REQUEST", "Invalid Realtime request.");
  }

  const { data: session, error: sessionError } = await auth.supabase
    .from("sessions")
    .select("id, title, session_type, status")
    .eq("id", parsed.data.sessionId)
    .maybeSingle();

  if (sessionError || !session) {
    return errorResponse(404, "SESSION_NOT_FOUND", "Session not found.");
  }
  if (session.status !== "active") {
    return errorResponse(
      409,
      "SESSION_NOT_ACTIVE",
      "Start the session before connecting Voice AI.",
    );
  }

  let config: ReturnType<typeof getRealtimeConfig>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    config = getRealtimeConfig();
    admin = createAdminClient();
  } catch {
    return errorResponse(
      503,
      "OPENAI_NOT_CONFIGURED",
      "Voice AI is not configured on the server.",
    );
  }

  const { data: settings } = await auth.supabase
    .from("user_settings")
    .select("ai_preferences")
    .eq("user_id", auth.userId)
    .maybeSingle();
  const preferences = settings?.ai_preferences;
  const savedVoiceCandidate =
    preferences &&
    typeof preferences === "object" &&
    "realtime_voice" in preferences
      ? preferences.realtime_voice
      : null;
  const savedVoice = isRealtimeVoice(savedVoiceCandidate)
    ? savedVoiceCandidate
    : null;
  const requestedVoice = parsed.data.voice ?? savedVoice ?? config.defaultVoice;
  const voice: RealtimeVoice = isRealtimeVoice(requestedVoice)
    ? requestedVoice
    : "marin";

  const now = new Date();
  const staleBefore = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const minuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  await admin
    .from("realtime_connections")
    .update({ status: "ended", ended_at: now.toISOString() })
    .eq("user_id", auth.userId)
    .in("status", ["connecting", "connected"])
    .lt("started_at", staleBefore);

  const [{ count: recentCount }, { data: usageRows }] = await Promise.all([
    admin
      .from("realtime_connections")
      .select("*", { count: "exact", head: true })
      .eq("user_id", auth.userId)
      .gte("started_at", minuteAgo),
    admin
      .from("usage_events")
      .select("estimated_cost_usd")
      .eq("user_id", auth.userId)
      .gte("created_at", monthStart),
  ]);

  if ((recentCount ?? 0) >= 5) {
    return errorResponse(
      429,
      "REALTIME_RATE_LIMITED",
      "Too many Voice AI connection attempts. Wait one minute.",
    );
  }

  const monthCost = (usageRows ?? []).reduce(
    (sum, row) => sum + Number(row.estimated_cost_usd),
    0,
  );
  if (monthCost >= config.monthlyBudgetUsd) {
    return errorResponse(
      429,
      "MONTHLY_BUDGET_REACHED",
      "The configured monthly AI budget has been reached.",
    );
  }

  const { data: connection, error: connectionError } = await admin
    .from("realtime_connections")
    .insert({
      session_id: session.id,
      user_id: auth.userId,
      model: config.model,
      voice,
      status: "connecting",
    })
    .select("id")
    .single();

  if (connectionError || !connection) {
    // Keep provider/database details in server logs only; never return secrets
    // or raw database diagnostics to the browser.
    console.error("Realtime connection record insert failed", {
      code: connectionError?.code ?? "NO_CONNECTION_ROW",
      message: connectionError?.message ?? "Insert returned no row",
      details: connectionError?.details,
      hint: connectionError?.hint,
      sessionId: session.id,
      userId: auth.userId,
    });
    return errorResponse(
      connectionError?.code === "23505" ? 409 : 500,
      connectionError?.code === "23505"
        ? "SESSION_ALREADY_CONNECTED"
        : connectionError?.code
          ? `CONNECTION_RECORD_FAILED_${connectionError.code}`
          : "CONNECTION_RECORD_FAILED",
      connectionError?.code === "23505"
        ? "This session already has an active Voice AI connection."
        : "The Voice AI connection could not be initialized. Check server logs for the diagnostic details.",
    );
  }

  const safetyIdentifier = createHash("sha256")
    .update(auth.userId)
    .digest("hex");
  const providerResponse = await fetch(
    "https://api.openai.com/v1/realtime/client_secrets",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "OpenAI-Safety-Identifier": safetyIdentifier,
      },
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 60 },
        session: {
          type: "realtime",
          model: config.model,
          output_modalities: ["audio"],
          instructions: instructionsFor(session.session_type, session.title),
          max_output_tokens: 1200,
          audio: {
            input: {
              noise_reduction: { type: "near_field" },
              transcription: { model: config.transcriptionModel },
              turn_detection: {
                type: "semantic_vad",
                eagerness: "auto",
                create_response: true,
                interrupt_response: true,
              },
            },
            output: { voice },
          },
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  ).catch(() => null);

  if (!providerResponse) {
    await admin
      .from("realtime_connections")
      .update({ status: "failed", last_error_code: "network_error" })
      .eq("id", connection.id);
    return errorResponse(
      502,
      "OPENAI_NETWORK_ERROR",
      "OpenAI Realtime could not be reached.",
    );
  }

  const providerPayload: unknown = await providerResponse.json().catch(() => null);
  if (!providerResponse.ok) {
    const errorPayload = z
      .object({ error: z.object({ code: z.string().optional() }).optional() })
      .safeParse(providerPayload);
    const providerCode = errorPayload.success
      ? errorPayload.data.error?.code
      : undefined;
    await admin
      .from("realtime_connections")
      .update({
        status: "failed",
        last_error_code: providerCode ?? `http_${providerResponse.status}`,
      })
      .eq("id", connection.id);
    console.error("OpenAI Realtime client secret request failed", {
      status: providerResponse.status,
      code: providerCode,
      sessionId: session.id,
      userId: auth.userId,
    });
    return openAIError(providerResponse.status, providerCode);
  }

  const secret = openAISecretSchema.safeParse(providerPayload);
  if (!secret.success) {
    await admin
      .from("realtime_connections")
      .update({ status: "failed", last_error_code: "invalid_response" })
      .eq("id", connection.id);
    return errorResponse(
      502,
      "OPENAI_INVALID_RESPONSE",
      "OpenAI returned an invalid Realtime session response.",
    );
  }

  await admin
    .from("realtime_connections")
    .update({
      status: "connected",
      provider_session_id: secret.data.session.id,
    })
    .eq("id", connection.id);

  return NextResponse.json(
    {
      clientSecret: secret.data.value,
      expiresAt: secret.data.expires_at,
      connectionId: connection.id,
      model: config.model,
      voice,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
