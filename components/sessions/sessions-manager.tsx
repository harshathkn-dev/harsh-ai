"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { EmptyState, StatusBadge } from "@/components/dashboard/ui";
import { Toast } from "@/components/ui/toast";
import { SessionCreateWizard } from "@/components/sessions/session-create-wizard";
import type { SessionSummary, SessionType } from "@/lib/sessions/types";

type SessionsManagerProps = {
  initialSessions: SessionSummary[];
  openCreateInitially: boolean;
};

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? "The request could not be completed.";
}

function SessionCard({
  session,
  busy,
  onAction,
  onDelete,
}: {
  session: SessionSummary;
  busy: boolean;
  onAction: (id: string, action: "start" | "stop" | "archive") => void;
  onDelete: (id: string) => void;
}) {
  const displayDate = session.started_at ?? session.created_at;

  return (
    <article className="card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {session.session_type}
          </p>
          <h3 className="mt-1 truncate text-lg font-bold">{session.title}</h3>
        </div>
        <StatusBadge status={session.status} />
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {new Intl.DateTimeFormat("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(displayDate))}
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          className="button button-secondary min-h-9 px-3 py-1.5 text-sm"
          href={`/dashboard/sessions/${session.id}`}
        >
          Open
        </Link>
        {session.status === "draft" ? (
          <button
            className="button min-h-9 px-3 py-1.5 text-sm"
            disabled={busy}
            onClick={() => onAction(session.id, "start")}
            type="button"
          >
            Start
          </button>
        ) : null}
        {session.status === "active" ? (
          <button
            className="button min-h-9 px-3 py-1.5 text-sm"
            disabled={busy}
            onClick={() => onAction(session.id, "stop")}
            type="button"
          >
            Stop
          </button>
        ) : null}
        {session.status === "completed" ? (
          <button
            className="button button-secondary min-h-9 px-3 py-1.5 text-sm"
            disabled={busy}
            onClick={() => onAction(session.id, "archive")}
            type="button"
          >
            Archive
          </button>
        ) : null}
        <button
          className="min-h-9 rounded-lg px-3 text-sm font-semibold text-red-300 hover:bg-red-400/10"
          disabled={busy}
          onClick={() => onDelete(session.id)}
          type="button"
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export function SessionsManager({
  initialSessions,
  openCreateInitially,
}: SessionsManagerProps) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [showCreate, setShowCreate] = useState(openCreateInitially);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function createSession(data: { title: string; sessionType: SessionType; metadata: Record<string, unknown> }) {
    setCreating(true);
    setError(null);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      setError(await responseError(response));
      setCreating(false);
      return;
    }

    const body = (await response.json()) as { session: SessionSummary };
    router.push(`/dashboard/sessions/${body.session.id}`);
    router.refresh();
  }

  async function updateSession(
    id: string,
    action: "start" | "stop" | "archive",
  ) {
    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      setError(await responseError(response));
      setBusyId(null);
      return;
    }

    const body = (await response.json()) as { session: SessionSummary };
    setSessions((current) =>
      current.map((session) => (session.id === id ? body.session : session)),
    );
    setNotice(
      action === "start"
        ? "Session started."
        : action === "stop"
          ? "Session completed."
          : "Session archived.",
    );
    setBusyId(null);
    router.refresh();
  }

  async function deleteSession(id: string) {
    if (!window.confirm("Delete this session and all of its saved content?")) {
      return;
    }

    setBusyId(id);
    setError(null);
    const response = await fetch(`/api/sessions/${id}`, { method: "DELETE" });

    if (!response.ok) {
      setError(await responseError(response));
      setBusyId(null);
      return;
    }

    setSessions((current) => current.filter((session) => session.id !== id));
    setNotice("Session deleted.");
    setBusyId(null);
    router.refresh();
  }

  const openSessions = sessions.filter(
    (session) => session.status === "draft" || session.status === "active",
  );
  const completedSessions = sessions.filter(
    (session) =>
      session.status === "completed" || session.status === "archived",
  );

  return (
    <div className="mt-8 space-y-8">
      {notice ? (
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      ) : null}
      {error ? (
        <div
          className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <SessionCreateWizard busy={creating} onClose={() => setShowCreate(false)} onCreate={createSession} />
      ) : (
        <button className="button" onClick={() => setShowCreate(true)} type="button">
          Create session
        </button>
      )}

      <section>
        <div>
          <h2 className="text-xl font-bold">Active and draft</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sessions waiting to begin or currently running.
          </p>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {openSessions.length ? (
            openSessions.map((session) => (
              <SessionCard
                busy={busyId === session.id}
                key={session.id}
                onAction={updateSession}
                onDelete={deleteSession}
                session={session}
              />
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                description="Create a session to prepare an interview, meeting, or general call."
                title="No open sessions"
              />
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">Completed</h2>
        <p className="mt-1 text-sm text-slate-500">
          Finished and archived sessions remain available for review.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {completedSessions.length ? (
            completedSessions.map((session) => (
              <SessionCard
                busy={busyId === session.id}
                key={session.id}
                onAction={updateSession}
                onDelete={deleteSession}
                session={session}
              />
            ))
          ) : (
            <div className="md:col-span-2 xl:col-span-3">
              <EmptyState
                description="Completed sessions will be stored here with their transcripts and notes."
                title="No completed sessions"
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
