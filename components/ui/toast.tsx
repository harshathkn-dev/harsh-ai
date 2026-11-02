"use client";

import { useEffect } from "react";

export function Toast({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string;
  tone?: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 4500);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      aria-live="polite"
      className={`fixed right-4 top-4 z-50 flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-2xl ${
        tone === "error"
          ? "border-red-300/20 bg-red-950 text-red-100"
          : "border-emerald-300/20 bg-emerald-950 text-emerald-100"
      }`}
      role={tone === "error" ? "alert" : "status"}
    >
      <p className="leading-6">{message}</p>
      <button
        aria-label="Dismiss notification"
        className="text-lg leading-5 opacity-70 hover:opacity-100"
        onClick={onDismiss}
        type="button"
      >
        ×
      </button>
    </div>
  );
}
