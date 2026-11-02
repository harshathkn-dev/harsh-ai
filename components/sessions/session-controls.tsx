"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SessionStatus } from "@/lib/sessions/types";

export function SessionControls({
  sessionId,
  status,
}: {
  sessionId: string;
  status: SessionStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update(action: "start" | "stop" | "archive") {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "The session could not be updated.");
      setBusy(false);
      return;
    }

    setBusy(false);
    router.refresh();
  }

  async function remove() {
    if (!window.confirm("Permanently delete this session and its content?")) {
      return;
    }

    setBusy(true);
    setError(null);
    const response = await fetch(`/api/sessions/${sessionId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "The session could not be deleted.");
      setBusy(false);
      return;
    }

    router.push("/dashboard/sessions");
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {status === "draft" ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => update("start")}
            type="button"
          >
            {busy ? "Starting…" : "Start session"}
          </button>
        ) : null}
        {status === "active" ? (
          <button
            className="button"
            disabled={busy}
            onClick={() => update("stop")}
            type="button"
          >
            {busy ? "Stopping…" : "Stop session"}
          </button>
        ) : null}
        {status === "completed" ? (
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={() => update("archive")}
            type="button"
          >
            Archive
          </button>
        ) : null}
        <button
          className="rounded-xl px-4 py-2 text-sm font-bold text-red-300 hover:bg-red-400/10"
          disabled={busy}
          onClick={remove}
          type="button"
        >
          Delete
        </button>
      </div>
      {error ? (
        <p className="mt-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
