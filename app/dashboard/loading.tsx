export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="h-4 w-32 animate-pulse rounded bg-white/10" />
      <div className="mt-4 h-10 w-72 max-w-full animate-pulse rounded-xl bg-white/10" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            className="card h-32 animate-pulse rounded-2xl"
            key={index}
          />
        ))}
      </div>
      <div className="card mt-8 h-80 animate-pulse rounded-2xl" />
    </div>
  );
}
