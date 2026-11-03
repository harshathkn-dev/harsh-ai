import { NextResponse } from "next/server";

import { getAuthenticatedUser } from "@/lib/auth/user";
import { getRealtimeConfig } from "@/lib/openai/realtime-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.question !== "string" ||
    !body.question.trim() ||
    body.question.length > 8000
  ) {
    return NextResponse.json({ error: "Enter a question (up to 8,000 characters)." }, { status: 400 });
  }

  let apiKey: string;
  try {
    apiKey = getRealtimeConfig().apiKey;
  } catch {
    return NextResponse.json({ error: "AI answers are not configured. Add OPENAI_API_KEY in Vercel environment variables." }, { status: 503 });
  }

  const context = [
    typeof body.sessionTitle === "string" ? `Session: ${body.sessionTitle}` : "",
    typeof body.company === "string" ? `Company: ${body.company}` : "",
    typeof body.jobDescription === "string" ? `Job description: ${body.jobDescription}` : "",
    typeof body.resumeContext === "string" ? `Resume context: ${body.resumeContext}` : "",
  ].filter(Boolean).join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_ANSWER_MODEL || "gpt-4.1-mini",
      instructions: "You are a real-time interview answer assistant. Provide a practical, natural answer the user can say aloud. Use first-person phrasing only when it fits an interview answer. Ground experience-specific claims in supplied resume/context; never invent credentials, employers, projects, or facts. Structure answers with a concise direct response and helpful details. For technical questions, explain approach, tradeoffs, tools, and a realistic example. Keep answers useful and not overly long.",
      input: `${context}\n\nQuestion to answer: ${body.question.trim()}`,
      max_output_tokens: 900,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30000),
  }).catch(() => null);

  if (!response) {
    return NextResponse.json({ error: "The AI answer service could not be reached." }, { status: 502 });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = response.status === 429
      ? "OpenAI API quota or rate limit reached. Check API billing and usage."
      : "The AI could not generate an answer. Please try again.";
    return NextResponse.json({ error: message }, { status: response.status === 429 ? 429 : 502 });
  }

  const answer = typeof result?.output_text === "string"
    ? result.output_text.trim()
    : Array.isArray(result?.output)
      ? result.output.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? []).map((item: { text?: string }) => item.text ?? "").join("\n").trim()
      : "";

  if (!answer) {
    return NextResponse.json({ error: "The AI returned an empty answer. Try rephrasing the question." }, { status: 502 });
  }

  return NextResponse.json({ answer }, { headers: { "Cache-Control": "no-store" } });
}
