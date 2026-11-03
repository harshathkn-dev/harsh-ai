import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/user";
import { realtimeVoiceSettingsSchema } from "@/lib/realtime/validation";

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = realtimeVoiceSettingsSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Select a supported Realtime voice." },
      { status: 400 },
    );
  }

  const { data: settings } = await auth.supabase
    .from("user_settings")
    .select("ai_preferences")
    .eq("user_id", auth.userId)
    .maybeSingle();
  const current =
    settings?.ai_preferences &&
    typeof settings.ai_preferences === "object" &&
    !Array.isArray(settings.ai_preferences)
      ? settings.ai_preferences
      : {};

  const { error } = await auth.supabase
    .from("user_settings")
    .update({
      ai_preferences: {
        ...current,
        realtime_voice: parsed.data.voice,
      },
    })
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json(
      { error: "Voice preference could not be saved." },
      { status: 500 },
    );
  }

  return NextResponse.json({ voice: parsed.data.voice });
}
