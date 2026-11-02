import { redirect } from "next/navigation";

import { signOut } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const [params, supabase] = await Promise.all([
    searchParams,
    createClient(),
  ]);
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "Signed-in user";

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <nav className="flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-black">Harsh&apos;s AI</p>
          <p className="text-sm text-slate-400">{email}</p>
        </div>
        <form action={signOut}>
          <button className="button button-secondary" type="submit">
            Sign out
          </button>
        </form>
      </nav>

      <section className="mt-14">
        <AuthMessage error={params.error} message={params.message} />
        <p className="font-semibold text-emerald-300">PRIVATE WORKSPACE</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">
          Your AI workspace is ready.
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-300">
          Authentication is wired. Session capture, document analysis, usage
          controls, and integration health will be enabled in the next stages.
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["Sessions", "Documents", "AI usage"].map((label) => (
          <article className="card rounded-2xl p-6" key={label}>
            <h2 className="text-lg font-bold">{label}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Configuration in progress.
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
