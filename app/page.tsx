import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
      <nav className="flex items-center justify-between">
        <Link className="text-lg font-bold tracking-tight" href="/">
          Harsh&apos;s AI
        </Link>
        <div className="flex gap-3">
          <Link className="button button-secondary" href="/login">
            Sign in
          </Link>
          <Link className="button" href="/signup">
            Get started
          </Link>
        </div>
      </nav>

      <section className="flex flex-1 items-center py-20">
        <div className="max-w-3xl">
          <p className="mb-4 font-semibold text-emerald-300">
            AI-assisted interview workspace
          </p>
          <h1 className="text-5xl font-black leading-tight tracking-tight sm:text-7xl">
            Prepare, capture, and learn from every session.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
            Secure authentication, document-grounded answers, transcription,
            session notes, and transparent usage controls in one private
            workspace.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link className="button" href="/signup">
              Create your account
            </Link>
            <Link className="button button-secondary" href="/login">
              Open dashboard
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
