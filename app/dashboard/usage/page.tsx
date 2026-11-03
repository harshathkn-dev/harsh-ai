import { EmptyState, MetricCard, PageHeader } from "@/components/dashboard/ui";
import { requireAuthenticatedUser } from "@/lib/auth/user";

function metadataValue(metadata: unknown, key: string) {
  return metadata && typeof metadata === "object"
    ? Reflect.get(metadata, key)
    : undefined;
}

export default async function UsagePage() {
  const { supabase } = await requireAuthenticatedUser();
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: events, error } = await supabase
    .from("usage_events")
    .select(
      "id, feature, model, input_tokens, output_tokens, audio_seconds, estimated_cost_usd, metadata, created_at",
    )
    .gte("created_at", monthStart.toISOString())
    .order("created_at", { ascending: false });

  const totals = (events ?? []).reduce(
    (sum, event) => ({
      input: sum.input + Number(event.input_tokens),
      output: sum.output + Number(event.output_tokens),
      audio: sum.audio + Number(event.audio_seconds),
      cost: sum.cost + Number(event.estimated_cost_usd),
      realtimeDuration:
        sum.realtimeDuration +
        Number(metadataValue(event.metadata, "session_duration_seconds") ?? 0),
      pendingCosts:
        sum.pendingCosts +
        (String(metadataValue(event.metadata, "cost_status") ?? "").startsWith(
          "pending",
        )
          ? 1
          : 0),
    }),
    {
      input: 0,
      output: 0,
      audio: 0,
      cost: 0,
      realtimeDuration: 0,
      pendingCosts: 0,
    },
  );

  return (
    <>
      <PageHeader
        description="Provider-reported token and transcription usage recorded by Harsh's AI."
        eyebrow="Current calendar month"
        title="AI usage"
      />

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="Recorded AI operations"
          label="Requests"
          value={events?.length ?? 0}
        />
        <MetricCard
          detail="Prompt and context tokens"
          label="Input tokens"
          value={totals.input.toLocaleString()}
        />
        <MetricCard
          detail="Generated answer tokens"
          label="Output tokens"
          value={totals.output.toLocaleString()}
        />
        <MetricCard
          detail={`${(totals.realtimeDuration / 60).toFixed(2)} Realtime minutes · ${totals.pendingCosts} costs pending`}
          label="Estimated cost"
          value={`$${totals.cost.toFixed(4)}`}
        />
      </section>

      <section className="card mt-8 rounded-2xl p-5 sm:p-6">
        <h2 className="text-lg font-bold">Usage events</h2>
        <p className="mt-1 text-sm text-slate-500">
          Application estimates may differ from the provider invoice.
        </p>

        <div className="mt-5">
          {error ? (
            <p className="text-sm text-red-200" role="alert">
              Usage records could not be loaded.
            </p>
          ) : events?.length ? (
            <div className="divide-y divide-white/10">
              {events.map((event) => (
                <div
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  key={event.id}
                >
                  <div>
                    <p className="font-semibold capitalize">{event.feature}</p>
                    <p className="mt-1 text-xs text-slate-500">{event.model}</p>
                  </div>
                  <div className="text-sm text-slate-400 sm:text-right">
                    <p>
                      {(
                        Number(event.input_tokens) +
                        Number(event.output_tokens)
                      ).toLocaleString()}{" "}
                      tokens ·{" "}
                      {String(
                        metadataValue(event.metadata, "cost_status") ?? "",
                      ).startsWith("pending")
                        ? "Cost pending"
                        : `$${Number(event.estimated_cost_usd).toFixed(6)}`}
                    </p>
                    <p className="mt-1 text-xs">
                      {new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(event.created_at))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              description="Real token, transcription, and estimated cost records will appear after AI requests are made."
              title="No usage recorded this month"
            />
          )}
        </div>
      </section>
    </>
  );
}
