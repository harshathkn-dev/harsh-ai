import Link from "next/link";

import {
  DataError,
  EmptyState,
  MetricCard,
  PageHeader,
  StatusBadge,
} from "@/components/dashboard/ui";
import { requireAuthenticatedUser } from "@/lib/auth/user";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function costIsPending(metadata: unknown) {
  return (
    metadata !== null &&
    typeof metadata === "object" &&
    String(Reflect.get(metadata, "cost_status") ?? "").startsWith("pending")
  );
}

export default async function DashboardPage() {
  const { supabase } = await requireAuthenticatedUser();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [
    sessionsResult,
    activeResult,
    documentsResult,
    recentSessionsResult,
    recentDocumentsResult,
    usageResult,
  ] = await Promise.all([
    supabase.from("sessions").select("*", { count: "exact", head: true }),
    supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("status", "active"),
    supabase.from("documents").select("*", { count: "exact", head: true }),
    supabase
      .from("sessions")
      .select("id, title, status, created_at, started_at")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("documents")
      .select("id, original_name, status, created_at")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("usage_events")
      .select(
        "input_tokens, output_tokens, audio_seconds, estimated_cost_usd, metadata",
      )
      .gte("created_at", monthStart.toISOString()),
  ]);

  const queryError = [
    sessionsResult.error,
    activeResult.error,
    documentsResult.error,
    recentSessionsResult.error,
    recentDocumentsResult.error,
    usageResult.error,
  ].find(Boolean);
  const usage = (usageResult.data ?? []).reduce(
    (total, event) => ({
      tokens:
        total.tokens +
        Number(event.input_tokens) +
        Number(event.output_tokens),
      cost: total.cost + Number(event.estimated_cost_usd),
      pending: total.pending + (costIsPending(event.metadata) ? 1 : 0),
    }),
    { tokens: 0, cost: 0, pending: 0 },
  );

  return (
    <>
      <PageHeader
        action={
          <Link className="button" href="/dashboard/sessions?create=1">
            Create session
          </Link>
        }
        description="A live view of your sessions, knowledge library, and AI activity."
        eyebrow="Workspace overview"
        title="Dashboard"
      />

      {queryError ? (
        <div className="mt-6">
          <DataError message="Some dashboard data could not be loaded. Confirm the Supabase migration and production environment configuration." />
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="All sessions you own"
          label="Total sessions"
          value={sessionsResult.count ?? 0}
        />
        <MetricCard
          detail="Currently in progress"
          label="Active sessions"
          value={activeResult.count ?? 0}
        />
        <MetricCard
          detail="Private files in Supabase"
          label="Documents"
          value={documentsResult.count ?? 0}
        />
        <MetricCard
          detail={`${usage.tokens.toLocaleString()} tokens this month${usage.pending ? ` · ${usage.pending} costs pending` : ""}`}
          label="Estimated AI cost"
          value={
            usage.pending && usage.cost === 0
              ? "Pending"
              : `$${usage.cost.toFixed(4)}`
          }
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Recent sessions</h2>
              <p className="mt-1 text-sm text-slate-500">
                Your latest interview, meeting, and general sessions.
              </p>
            </div>
            <Link
              className="text-sm font-bold text-emerald-300"
              href="/dashboard/sessions"
            >
              View all
            </Link>
          </div>

          <div className="mt-5">
            {recentSessionsResult.data?.length ? (
              <div className="divide-y divide-white/10">
                {recentSessionsResult.data.map((session) => (
                  <Link
                    className="flex items-center justify-between gap-4 py-4 transition hover:translate-x-1"
                    href={`/dashboard/sessions/${session.id}`}
                    key={session.id}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{session.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDate(session.started_at ?? session.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={session.status} />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                action="Create your first session"
                description="Sessions you create will appear here with their real status and activity."
                href="/dashboard/sessions?create=1"
                title="No sessions yet"
              />
            )}
          </div>
        </article>

        <article className="card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Documents</h2>
              <p className="mt-1 text-sm text-slate-500">Recently uploaded files.</p>
            </div>
            <Link
              className="text-sm font-bold text-emerald-300"
              href="/dashboard/documents"
            >
              Open
            </Link>
          </div>
          <div className="mt-5">
            {recentDocumentsResult.data?.length ? (
              <div className="space-y-3">
                {recentDocumentsResult.data.map((document) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3"
                    key={document.id}
                  >
                    <p className="min-w-0 truncate text-sm font-semibold">
                      {document.original_name}
                    </p>
                    <StatusBadge status={document.status} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                description="Your private uploaded documents will be listed here."
                title="No documents"
              />
            )}
          </div>
        </article>
      </section>
    </>
  );
}
