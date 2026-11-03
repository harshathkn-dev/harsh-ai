export const REALTIME_VOICES = [
  "marin",
  "cedar",
  "coral",
  "verse",
] as const;

export type RealtimeVoice = (typeof REALTIME_VOICES)[number];

export function isRealtimeVoice(value: unknown): value is RealtimeVoice {
  return (
    typeof value === "string" &&
    REALTIME_VOICES.some((voice) => voice === value)
  );
}

export type VoiceConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "listening"
  | "processing"
  | "speaking"
  | "muted"
  | "error";

export type LiveTranscriptMessage = {
  providerItemId: string;
  responseId?: string;
  role: "user" | "assistant";
  text: string;
  status: "in_progress" | "completed" | "cancelled" | "incomplete" | "failed";
};
