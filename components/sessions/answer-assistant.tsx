"use client";

import { useState } from "react";

type AnswerAssistantProps = {
  sessionTitle: string;
  company?: string | null;
  jobDescription?: string | null;
  resumeContext?: string | null;
};

export function AnswerAssistant({
  sessionTitle,
  company,
  jobDescription,
  resumeContext,
}: AnswerAssistantProps) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(true);

  function createDemoAnswer(prompt: string) {
    return [
      "DEMO RESPONSE — sample content, not AI-generated",
      "",
      `Question received: ${prompt.trim()}`,
      "",
      "A clear way to answer is to start with the direct point, explain the approach you would take, and finish with a practical example.",
      "",
      "Suggested structure:",
      "1. Give a concise answer to the question.",
      "2. Explain the key steps, tools, or trade-offs involved.",
      "3. Add a real example from your own experience.",
      "4. Close with the result or lesson learned.",
      "",
      "This demo verifies the answer panel and copy interaction only. Enable Live AI after configuring API billing to receive a genuinely generated answer.",
    ].join("\\n");
  }

  async function generateAnswer() {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError("");
    setAnswer("");
    if (demoMode) {
      setAnswer(createDemoAnswer(question));
      setLoading(false);
      return;
    }
    const response = await fetch("/api/answer-assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, sessionTitle, company, jobDescription, resumeContext }),
    }).catch(() => null);
    const body = await response?.json().catch(() => null);
    if (!response?.ok) {
      setError(body?.error ?? "Unable to generate an answer.");
    } else {
      setAnswer(typeof body.answer === "string" ? body.answer : "");
    }
    setLoading(false);
  }

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-40 rounded-full bg-emerald-300 px-5 py-3 font-black text-slate-950 shadow-xl hover:bg-emerald-200"
        onClick={() => setOpen(true)}
        type="button"
      >
        ✦ AI Answer Assistant
      </button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/60 p-3 sm:items-center sm:p-6" onClick={() => setOpen(false)}>
          <section
            aria-labelledby="answer-assistant-title"
            aria-modal="true"
            className="card flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <header className="flex items-start justify-between border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Interview Copilot</p>
                <h2 className="mt-2 text-xl font-black" id="answer-assistant-title">Suggested answer</h2>
                <p className="mt-1 text-sm text-slate-400">Test the answer panel free, or switch to Live AI when API billing is enabled.</p>
              </div>
              <button aria-label="Close answer assistant" className="rounded-lg px-3 py-2 text-slate-400 hover:bg-white/10" onClick={() => setOpen(false)} type="button">✕</button>
            </header>
            <div className="space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <div>
                  <p className="text-sm font-bold">{demoMode ? "Free demo mode" : "Live AI mode"}</p>
                  <p className="mt-1 text-xs text-slate-400">{demoMode ? "No API call or billing. Uses a sample response." : "Uses your configured OpenAI API and may incur usage charges."}</p>
                </div>
                <button
                  className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/10"
                  onClick={() => { setDemoMode((current) => !current); setAnswer(""); setError(""); }}
                  type="button"
                >
                  Switch to {demoMode ? "Live AI" : "Free demo"}
                </button>
              </div>
              <label className="block text-sm font-semibold">
                Interview question
                <textarea className="field mt-2 min-h-28 w-full resize-y" onChange={(event) => setQuestion(event.target.value)} placeholder="Paste or type the question here…" value={question} />
              </label>
              <button className="button w-full" disabled={loading || !question.trim()} onClick={generateAnswer} type="button">
                {loading ? "Generating answer…" : answer ? "Generate another answer" : "Generate answer"}
              </button>
              {error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100" role="alert">{error}</p> : null}
              {answer ? (
                <section className="rounded-xl border border-emerald-300/20 bg-emerald-300/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-bold text-emerald-200">Suggested response</h3>
                    <button className="text-xs font-bold text-slate-300 hover:text-white" onClick={() => void navigator.clipboard.writeText(answer)} type="button">Copy</button>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-100">{answer}</p>
                </section>
              ) : null}
              <p className="text-xs leading-5 text-slate-500">Use suggestions as a guide and keep your response truthful to your own experience.</p>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
