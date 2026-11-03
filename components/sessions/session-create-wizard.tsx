"use client";

import { useEffect, useState } from "react";

type DocumentOption = { id: string; original_name: string; bucket_id: string; status: string };
type WizardProps = { busy: boolean; onClose: () => void; onCreate: (data: { title: string; sessionType: "interview" | "meeting" | "general"; metadata: Record<string, unknown> }) => void };

export function SessionCreateWizard({ busy, onClose, onCreate }: WizardProps) {
  const [step, setStep] = useState(1);
  const [sessionType, setSessionType] = useState<"interview" | "meeting" | "general">("interview");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [resumeId, setResumeId] = useState("");
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [documents, setDocuments] = useState<DocumentOption[]>([]);
  const [preferences, setPreferences] = useState({ answerStyle: "concise", answerLength: "medium", showHints: true, includeExamples: true, language: "English" });
  const [importError, setImportError] = useState("");

  useEffect(() => {
    fetch("/api/documents").then(async (r) => r.ok ? r.json() : null).then((body) => {
      if (Array.isArray(body?.documents)) setDocuments(body.documents);
    }).catch(() => undefined);
  }, []);

  async function importJob() {
    if (!jobUrl.trim()) return;
    setImportError("");
    try {
      const response = await fetch("/api/job-import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: jobUrl }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Could not import this job link.");
      setCompany(body.company ?? company);
      setJobDescription(body.jobDescription ?? jobDescription);
      if (!title && body.title) setTitle(body.title);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Job link import failed.");
    }
  }

  function submit() {
    const chosenResume = documents.find((item) => item.id === resumeId);
    onCreate({
      title: title.trim() || (company ? `${company} ${sessionType === "interview" ? "Interview" : "Session"}` : "New session"),
      sessionType,
      metadata: { company, jobDescription, jobUrl, resumeId, resumeName: chosenResume?.original_name ?? "", documentIds, preferences },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-6" onClick={onClose}>
      <section aria-modal="true" className="card grid max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 md:grid-cols-[260px_1fr]" onClick={(event) => event.stopPropagation()} role="dialog">
        <aside className="border-b border-white/10 bg-white/[0.02] p-5 md:border-b-0 md:border-r md:p-8">
          <h2 className="text-xl font-black">Create session</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Enter the details and choose what you need for this call.</p>
          <div className="mt-8 space-y-5 text-sm">
            {[["1", "Details"], ["2", "Preferences"]].map(([number, label], index) => <div className="flex items-center gap-3" key={number}><span className={step === index + 1 ? "grid size-8 place-items-center rounded-full bg-emerald-300 font-bold text-slate-950" : "grid size-8 place-items-center rounded-full border border-white/20 text-slate-400"}>{number}</span><span className={step === index + 1 ? "font-bold text-white" : "text-slate-400"}>{label}</span></div>)}
          </div>
        </aside>
        <div className="flex min-h-0 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-8"><p className="font-bold">{step === 1 ? "Session details" : "Answer preferences"}</p><button aria-label="Close" className="rounded-lg px-3 py-2 text-slate-400 hover:bg-white/10" onClick={onClose} type="button">✕</button></header>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-8">
            {step === 1 ? <>
              <div><label className="mb-2 block text-sm font-semibold">Session type</label><div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.06] p-1">{[["interview","▣ Interview"],["meeting","◉ Regular"],["general","♧ Mock"]].map(([value,label]) => <button className={sessionType === value ? "rounded-xl bg-white px-2 py-3 text-sm font-bold text-slate-950 shadow" : "rounded-xl px-2 py-3 text-sm font-semibold text-slate-300"} key={value} onClick={() => setSessionType(value as typeof sessionType)} type="button">{label}</button>)}</div></div>
              {sessionType === "interview" ? <div className="rounded-xl border border-white/10 p-4"><p className="text-sm text-slate-400">Have a link to the job post? Import details automatically.</p><div className="mt-3 flex gap-2"><input className="field min-w-0 flex-1" onChange={(e) => setJobUrl(e.target.value)} placeholder="Paste job post URL" type="url" value={jobUrl}/><button className="button button-secondary" onClick={importJob} type="button">Import link</button></div>{importError ? <p className="mt-2 text-sm text-red-300">{importError}</p> : null}</div> : null}
              <label className="block text-sm font-semibold">Session name<input className="field mt-2 w-full" maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Automation Engineer Interview" value={title}/></label>
              {sessionType === "interview" ? <><label className="block text-sm font-semibold">Company<input className="field mt-2 w-full" onChange={(e) => setCompany(e.target.value)} placeholder="Enter company name" value={company}/></label><label className="block text-sm font-semibold">Job description<textarea className="field mt-2 min-h-32 w-full resize-y" onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste job description…" value={jobDescription}/></label></> : null}
              <div><p className="mb-3 text-sm font-semibold text-slate-400">Context</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">CV / Resume<select className="field mt-2 w-full" onChange={(e) => setResumeId(e.target.value)} value={resumeId}><option value="">Select resume</option>{documents.filter((d) => d.bucket_id === "resumes").map((d) => <option key={d.id} value={d.id}>{d.original_name}</option>)}</select></label><label className="text-sm font-semibold">Documents<select className="field mt-2 w-full" onChange={(e) => { if (e.target.value && !documentIds.includes(e.target.value)) setDocumentIds((ids) => [...ids,e.target.value]); }} value=""><option value="">Select documents</option>{documents.filter((d) => d.bucket_id !== "resumes").map((d) => <option key={d.id} value={d.id}>{d.original_name}</option>)}</select><div className="mt-2 flex flex-wrap gap-1">{documentIds.map((id) => {const doc=documents.find((d)=>d.id===id);return doc?<button className="rounded-lg bg-white/10 px-2 py-1 text-xs" key={id} onClick={()=>setDocumentIds((ids)=>ids.filter((x)=>x!==id))} type="button">{doc.original_name} ×</button>:null;})}</div></label></div></div>
            </> : <>
              <div><h3 className="font-bold">How should the assistant respond?</h3><p className="mt-1 text-sm text-slate-400">These preferences are saved with this session.</p></div>
              <label className="block text-sm font-semibold">Answer style<select className="field mt-2 w-full" onChange={(e)=>setPreferences((p)=>({...p,answerStyle:e.target.value}))} value={preferences.answerStyle}><option value="concise">Concise and direct</option><option value="conversational">Natural and conversational</option><option value="structured">Structured (STAR / steps)</option></select></label>
              <label className="block text-sm font-semibold">Answer length<select className="field mt-2 w-full" onChange={(e)=>setPreferences((p)=>({...p,answerLength:e.target.value}))} value={preferences.answerLength}><option value="short">Short</option><option value="medium">Medium</option><option value="detailed">Detailed</option></select></label>
              <label className="block text-sm font-semibold">Language<select className="field mt-2 w-full" onChange={(e)=>setPreferences((p)=>({...p,language:e.target.value}))} value={preferences.language}><option>English</option><option>Kannada</option><option>Hindi</option></select></label>
              <label className="flex items-center gap-3 text-sm"><input checked={preferences.showHints} onChange={(e)=>setPreferences((p)=>({...p,showHints:e.target.checked}))} type="checkbox"/>Show answer hints</label>
              <label className="flex items-center gap-3 text-sm"><input checked={preferences.includeExamples} onChange={(e)=>setPreferences((p)=>({...p,includeExamples:e.target.checked}))} type="checkbox"/>Include practical examples</label>
            </>}
          </div>
          <footer className="flex justify-end gap-3 border-t border-white/10 p-5 sm:px-8"><button className="button button-secondary" onClick={step === 1 ? onClose : () => setStep(1)} type="button">{step === 1 ? "Cancel" : "Back"}</button>{step === 1 ? <button className="button" onClick={() => setStep(2)} type="button">Next</button> : <button className="button" disabled={busy} onClick={submit} type="button">{busy ? "Creating…" : "Create session"}</button>}</footer>
        </div>
      </section>
    </div>
  );
}
