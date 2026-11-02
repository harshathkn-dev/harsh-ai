import Link from "next/link";

type AuthShellProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

export function AuthShell({
  title,
  description,
  children,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <section className="card w-full max-w-md rounded-3xl p-7 sm:p-9">
        <Link className="text-sm font-bold text-emerald-300" href="/">
          HARSH&apos;S AI
        </Link>
        <h1 className="mt-5 text-3xl font-black tracking-tight">{title}</h1>
        <p className="mt-2 leading-7 text-slate-300">{description}</p>
        <div className="mt-7">{children}</div>
      </section>
    </main>
  );
}
