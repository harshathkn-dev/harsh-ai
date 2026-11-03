import Link from "next/link";

import { PageHeader } from "@/components/dashboard/ui";
import { RealtimeVoiceSettings } from "@/components/settings/realtime-voice-settings";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { isRealtimeVoice } from "@/lib/realtime/types";

export default async function SettingsPage() {
  const { supabase, userId, email } = await requireAuthenticatedUser();
  const [{ data: profile }, { data: settings }, { data: role }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url, created_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("user_settings")
        .select(
          "timezone, email_notifications, session_completion_email, preferred_answer_mode, ai_preferences",
        )
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  const preferences = settings?.ai_preferences;
  const voiceCandidate =
    preferences &&
    typeof preferences === "object" &&
    "realtime_voice" in preferences
      ? preferences.realtime_voice
      : null;
  const realtimeVoice = isRealtimeVoice(voiceCandidate)
    ? voiceCandidate
    : "marin";

  return (
    <>
      <PageHeader
        description="Review your identity, preferences, and account security."
        eyebrow="Account"
        title="Settings"
      />

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <section className="card rounded-2xl p-6">
          <h2 className="text-lg font-bold">Profile</h2>
          <dl className="mt-5 space-y-4">
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Name
              </dt>
              <dd className="mt-1 font-semibold">
                {profile?.full_name || "Not provided"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Account email
              </dt>
              <dd className="mt-1 font-semibold">{email ?? "Unavailable"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Access role
              </dt>
              <dd className="mt-1 font-semibold capitalize">
                {role?.role ?? "user"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card rounded-2xl p-6">
          <h2 className="text-lg font-bold">Preferences</h2>
          <dl className="mt-5 space-y-4">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Timezone</dt>
              <dd className="font-semibold">
                {settings?.timezone ?? "Asia/Kolkata"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Answer style</dt>
              <dd className="font-semibold capitalize">
                {settings?.preferred_answer_mode ?? "concise"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Email notifications</dt>
              <dd className="font-semibold">
                {settings?.email_notifications === false ? "Off" : "On"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="card rounded-2xl p-6 xl:col-span-2">
          <h2 className="text-lg font-bold">Realtime Voice AI</h2>
          <p className="mb-5 mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Choose the voice used for new speech-to-speech WebRTC connections.
            API keys and provider secrets are never shown here.
          </p>
          <RealtimeVoiceSettings initialVoice={realtimeVoice} />
        </section>

        <section className="card rounded-2xl p-6 xl:col-span-2">
          <h2 className="text-lg font-bold">Password and authentication</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Password changes use the existing secure Supabase recovery flow.
            Secret integration values are never displayed in this page.
          </p>
          <Link className="button button-secondary mt-5" href="/forgot-password">
            Reset password
          </Link>
        </section>
      </div>
    </>
  );
}
