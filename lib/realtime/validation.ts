import { z } from "zod";

import { REALTIME_VOICES } from "@/lib/realtime/types";

const id = z.string().trim().min(1).max(200);
const nonNegativeInteger = z.number().int().min(0).max(100_000_000);

export const realtimeSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
  voice: z.enum(REALTIME_VOICES).optional(),
});

export const realtimeMessageEventSchema = z.object({
  type: z.literal("message"),
  sessionId: z.string().uuid(),
  connectionId: z.string().uuid(),
  providerItemId: id,
  responseId: id.optional(),
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(50_000),
  status: z
    .enum(["in_progress", "completed", "cancelled", "incomplete", "failed"])
    .default("completed"),
});

export const realtimeUsageEventSchema = z.object({
  type: z.literal("usage"),
  sessionId: z.string().uuid(),
  connectionId: z.string().uuid(),
  responseId: id,
  usageKind: z.enum(["response", "transcription"]).default("response"),
  usage: z.union([
    z.object({
      type: z.literal("duration"),
      seconds: z.number().finite().min(0).max(86_400),
    }),
    z.object({
      type: z.literal("tokens").optional(),
      input_tokens: nonNegativeInteger,
      output_tokens: nonNegativeInteger,
      input_token_details: z
        .object({
          audio_tokens: nonNegativeInteger.optional(),
          text_tokens: nonNegativeInteger.optional(),
        })
        .optional(),
      output_token_details: z
        .object({
          audio_tokens: nonNegativeInteger.optional(),
          text_tokens: nonNegativeInteger.optional(),
        })
        .optional(),
    }),
  ]),
});

export const realtimeEventSchema = z.discriminatedUnion("type", [
  realtimeMessageEventSchema,
  realtimeUsageEventSchema,
]);

export const realtimeEndSchema = z.object({
  sessionId: z.string().uuid(),
  connectionId: z.string().uuid(),
  errorCode: z.string().trim().max(120).optional(),
});

export const realtimeVoiceSettingsSchema = z.object({
  voice: z.enum(REALTIME_VOICES),
});
