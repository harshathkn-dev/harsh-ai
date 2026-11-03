import "server-only";

function required(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function positiveNumber(value: string | undefined) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function getRealtimeConfig() {
  return {
    apiKey: required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1",
    transcriptionModel:
      process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL ||
      "gpt-4o-mini-transcribe",
    defaultVoice: process.env.OPENAI_REALTIME_DEFAULT_VOICE || "marin",
    monthlyBudgetUsd: positiveNumber(process.env.OPENAI_MONTHLY_BUDGET_USD) ?? 5,
  };
}

export function getRealtimePricing() {
  const rates = {
    textInput: positiveNumber(
      process.env.OPENAI_REALTIME_TEXT_INPUT_USD_PER_1M_TOKENS,
    ),
    textOutput: positiveNumber(
      process.env.OPENAI_REALTIME_TEXT_OUTPUT_USD_PER_1M_TOKENS,
    ),
    audioInput: positiveNumber(
      process.env.OPENAI_REALTIME_AUDIO_INPUT_USD_PER_1M_TOKENS,
    ),
    audioOutput: positiveNumber(
      process.env.OPENAI_REALTIME_AUDIO_OUTPUT_USD_PER_1M_TOKENS,
    ),
  };

  if (
    rates.textInput === null ||
    rates.textOutput === null ||
    rates.audioInput === null ||
    rates.audioOutput === null
  ) {
    return null;
  }

  return rates;
}
