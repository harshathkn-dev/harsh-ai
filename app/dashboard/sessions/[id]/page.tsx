import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DataError,
  EmptyState,
  StatusBadge,
} from "@/components/dashboard/ui";
import { VoiceAiPanel } from "@/components/realtime/voice-ai-panel";
import { SessionControls } from "@/components/sessions/session-controls";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import { isRealtimeVoice } from "@/lib/realtime/types";
import type { SessionStatus } from "@/lib/sessions/types";

type SessionDetailPageProps = {
  params: Promise<{ id: string }>;
};

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function SessionDetailPage({
  params,
}: SessionDetailPageProps) {
  const [{ id }, { supabase, userId }] = await Promise.all([
    params,
    requireAuthenticatedUser(),
  ]);
  const { data: session, error } = await supabase
    .from("sessions")
    .select(
      "id, title, session_type, status, started_at, ended_at, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !session) {
    notFound();
  }

  const [messagesResult, transcriptsResult, notesResult, settingsResult] =
    await Promise.all([
      supabase
        .from("session_messages")
        .select("id, role, content, model, created_at")
        .eq("session_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("transcripts")
        .select(
          "id, transcript_text, language, duration_seconds, status, created_at",
        )
        .eq("session_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("ai_notes")
        .select("id, note_type, title, content, model, created_at")
        .eq("session_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("user_settings")
        .select("ai_preferences")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
  const contentError =
    messagesResult.error || transcriptsResult.error || notesResult.error;
  const preferences = settingsResult.data?.ai_preferences;
  const voiceCandidate =
    preferences &&
    typeof preferences === "object" &&
    "realtime_voice" in preferences
      ? preferences.realtime_voice
      : null;
  const initialVoice = isRealtimeVoice(voiceCandidate)
    ? voiceCandidate
    : "marin";

  return (
    <>
      <Link
        className="text-sm font-bold text-slate-400 hover:text-white"
        href="/dashboard/sessions"
      >
        ← All sessions
      </Link>

      <header className="mt-6 flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
              {session.session_type} session
            </p>
            <StatusBadge status={session.status} />
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            {session.title}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            Created {dateTime(session.created_at)}
          </p>
        </div>
        <SessionControls
          sessionId={session.id}
          status={session.status as SessionStatus}
        />
      </header>

      {contentError ? (
        <div className="mt-6">
          <DataError message="Some saved session content could not be loaded. Refresh the page or verify the database migration." />
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <article className="card rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Started
          </p>
          <p className="mt-2 font-semibold">{dateTime(session.started_at)}</p>
        </article>
        <article className="card rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Ended
          </p>
          <p className="mt-2 font-semibold">{dateTime(session.ended_at)}</p>
        </article>
        <article className="card rounded-2xl p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Conversation messages
          </p>
          <p className="mt-2 text-2xl font-black">
            {messagesResult.data?.length ?? 0}
          </p>
        </article>
      </section>

      {session.status === "draft" || session.status === "active" ? (
        <VoiceAiPanel
          initialVoice={initialVoice}
          sessionId={session.id}
          sessionStatus={session.status}
        />
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="card rounded-2xl p-5 sm:p-6">
          <h2 className="text-lg font-bold">Conversation</h2>
          <p className="mt-1 text-sm text-slate-500">
            Persisted messages associated with this session.
          </p>
          <div className="mt-5">
            {messagesResult.data?.length ? (
              <div className="space-y-4">
                {messagesResult.data.map((message) => (
                  <article
                    className={`max-w-[90%] rounded-2xl p-4 ${
                      message.role === "user"
                        ? "ml-auto bg-emerald-300 text-slate-950"
                        : "border border-white/10 bg-white/5"
                    }`}
                    key={message.id}
                  >
                    <p className="text-xs font-black uppercase tracking-wider opacity-60">
                      {message.role}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                      {message.content}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Messages will appear here when this session is used with the AI assistant."
                title="No conversation yet"
              />
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="card rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-bold">Transcripts</h2>
            <div className="mt-4">
              {transcriptsResult.data?.length ? (
                <div className="space-y-3">
                  {transcriptsResult.data.map((transcript) => (
                    <article
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                      key={transcript.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge status={transcript.status} />
                        <p className="text-xs text-slate-500">
                          {Number(transcript.duration_seconds).toFixed(1)} sec
                        </p>
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {transcript.transcript_text || "Transcript text unavailable."}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Uploaded-audio transcripts saved to this session will appear here."
                  title="No transcripts"
                />
              )}
            </div>
          </section>

          <section className="card rounded-2xl p-5 sm:p-6">
            <h2 className="text-lg font-bold">AI notes and summaries</h2>
            <div className="mt-4">
              {notesResult.data?.length ? (
                <div className="space-y-3">
                  {notesResult.data.map((note) => (
                    <article
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                      key={note.id}
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        {note.note_type}
                      </p>
                      {note.title ? (
                        <h3 className="mt-2 font-bold">{note.title}</h3>
                      ) : null}
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                        {note.content}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  description="Real generated notes and summaries will be stored here."
                  title="No AI notes"
                />
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
