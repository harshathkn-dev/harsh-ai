"use client";

import { useState } from "react";

import { Toast } from "@/components/ui/toast";
import {
  REALTIME_VOICES,
  type RealtimeVoice,
} from "@/lib/realtime/types";

export function RealtimeVoiceSettings({
  initialVoice,
}: {
  initialVoice: RealtimeVoice;
}) {
  const [voice, setVoice] = useState(initialVoice);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/settings/realtime", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voice }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(body?.error ?? "Voice preference could not be saved.");
      setSaving(false);
      return;
    }

    setNotice("Realtime voice preference saved.");
    setSaving(false);
  }

  return (
    <div>
      {notice ? (
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      ) : null}
      <label className="block max-w-sm text-sm font-semibold">
        Realtime AI voice
        <select
          className="field mt-2 capitalize"
          onChange={(event) =>
            setVoice(event.target.value as RealtimeVoice)
          }
          value={voice}
        >
          {REALTIME_VOICES.map((option) => (
            <option className="capitalize" key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <p className="mt-2 text-xs leading-5 text-slate-500">
        Marin and Cedar are recommended by OpenAI for the best voice quality.
      </p>
      <button
        className="button mt-4"
        disabled={saving}
        onClick={save}
        type="button"
      >
        {saving ? "Saving…" : "Save voice"}
      </button>
      {error ? (
        <p className="mt-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
