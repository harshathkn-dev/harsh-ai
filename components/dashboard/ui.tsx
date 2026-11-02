import Link from "next/link";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-slate-400">{description}</p>
      </div>
      {action}
    </header>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <article className="card rounded-2xl p-5">
      <p className="text-sm font-semibold text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{detail}</p>
    </article>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/5 text-lg text-slate-400">
        ···
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
      {href && action ? (
        <Link className="button mt-5" href={href}>
          {action}
        </Link>
      ) : null}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-emerald-300/12 text-emerald-200",
    completed: "bg-cyan-300/12 text-cyan-200",
    draft: "bg-amber-300/12 text-amber-200",
    archived: "bg-slate-300/10 text-slate-300",
    ready: "bg-emerald-300/12 text-emerald-200",
    processing: "bg-cyan-300/12 text-cyan-200",
    pending: "bg-amber-300/12 text-amber-200",
    failed: "bg-red-300/12 text-red-200",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ${
        styles[status] ?? "bg-white/5 text-slate-300"
      }`}
    >
      {status}
    </span>
  );
}

export function DataError({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
      role="alert"
    >
      {message}
    </div>
  );
}
