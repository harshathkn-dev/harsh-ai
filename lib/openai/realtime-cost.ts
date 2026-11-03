import "server-only";

import { getRealtimePricing } from "@/lib/openai/realtime-config";

export type RealtimeUsage = {
  input_tokens: number;
  output_tokens: number;
  input_token_details?: {
    audio_tokens?: number;
    text_tokens?: number;
  };
  output_token_details?: {
    audio_tokens?: number;
    text_tokens?: number;
  };
};

export function calculateRealtimeCost(usage: RealtimeUsage) {
  const pricing = getRealtimePricing();

  if (!pricing) {
    return {
      estimatedCostUsd: 0,
      costStatus: "pending_pricing_configuration" as const,
    };
  }

  const audioInput = usage.input_token_details?.audio_tokens ?? 0;
  const audioOutput = usage.output_token_details?.audio_tokens ?? 0;
  const textInput =
    usage.input_token_details?.text_tokens ??
    Math.max(0, usage.input_tokens - audioInput);
  const textOutput =
    usage.output_token_details?.text_tokens ??
    Math.max(0, usage.output_tokens - audioOutput);

  const estimatedCostUsd =
    (textInput * pricing.textInput +
      textOutput * pricing.textOutput +
      audioInput * pricing.audioInput +
      audioOutput * pricing.audioOutput) /
    1_000_000;

  return {
    estimatedCostUsd,
    costStatus: "estimated_from_configured_token_rates" as const,
  };
}
