import { DataError, PageHeader } from "@/components/dashboard/ui";
import { SessionsManager } from "@/components/sessions/sessions-manager";
import { requireAuthenticatedUser } from "@/lib/auth/user";
import type { SessionSummary } from "@/lib/sessions/types";

type SessionsPageProps = {
  searchParams: Promise<{ create?: string | string[] }>;
};

export default async function SessionsPage({
  searchParams,
}: SessionsPageProps) {
  const [{ supabase }, params] = await Promise.all([
    requireAuthenticatedUser(),
    searchParams,
  ]);
  const { data, error } = await supabase
    .from("sessions")
    .select(
      "id, title, session_type, status, started_at, ended_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false });
  const createValue = Array.isArray(params.create)
    ? params.create[0]
    : params.create;

  return (
    <>
      <PageHeader
        description="Create, run, and revisit your interviews, meetings, and general calls."
        eyebrow="Call workspace"
        title="Sessions"
      />
      {error ? (
        <div className="mt-8">
          <DataError message="Sessions could not be loaded. Apply the session-type migration in Supabase before using this page." />
        </div>
      ) : (
        <SessionsManager
          initialSessions={(data ?? []) as SessionSummary[]}
          openCreateInitially={createValue === "1"}
        />
      )}
    </>
  );
}
