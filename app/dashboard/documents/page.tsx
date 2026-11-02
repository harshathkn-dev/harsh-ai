import { EmptyState, PageHeader, StatusBadge } from "@/components/dashboard/ui";
import { requireAuthenticatedUser } from "@/lib/auth/user";

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const { supabase } = await requireAuthenticatedUser();
  const { data: documents, error } = await supabase
    .from("documents")
    .select(
      "id, original_name, mime_type, size_bytes, status, bucket_id, created_at",
    )
    .order("created_at", { ascending: false });

  return (
    <>
      <PageHeader
        description="Private files stored in your Supabase storage buckets."
        eyebrow="Knowledge library"
        title="Documents"
      />

      <section className="card mt-8 rounded-2xl p-5 sm:p-6">
        {error ? (
          <p className="text-sm text-red-200" role="alert">
            Documents could not be loaded. Confirm that the database migration
            has been applied.
          </p>
        ) : documents?.length ? (
          <div className="overflow-x-auto">
            <div className="min-w-[640px] divide-y divide-white/10">
              {documents.map((document) => (
                <div
                  className="grid grid-cols-[1fr_110px_120px_100px] items-center gap-4 py-4"
                  key={document.id}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {document.original_name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.mime_type} · {document.bucket_id}
                    </p>
                  </div>
                  <p className="text-sm text-slate-400">
                    {fileSize(Number(document.size_bytes))}
                  </p>
                  <p className="text-sm text-slate-400">
                    {new Intl.DateTimeFormat("en-IN", {
                      dateStyle: "medium",
                    }).format(new Date(document.created_at))}
                  </p>
                  <StatusBadge status={document.status} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            description="No files have been uploaded to your private document library."
            title="Your library is empty"
          />
        )}
      </section>
    </>
  );
}
