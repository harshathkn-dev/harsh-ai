import Link from "next/link";

import { signIn, signInWithGoogle } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = Array.isArray(params.next) ? params.next[0] : params.next;

  return (
    <AuthShell title="Welcome back" description="Sign in to your private workspace.">
      <AuthMessage error={params.error} message={params.message} />

      <form action={signIn} className="space-y-4">
        <input name="next" type="hidden" value={next ?? "/dashboard"} />
        <label className="block text-sm font-semibold">
          Email
          <input
            autoComplete="email"
            className="field mt-2"
            name="email"
            required
            type="email"
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            autoComplete="current-password"
            className="field mt-2"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <button className="button w-full" type="submit">
          Sign in
        </button>
      </form>

      <form action={signInWithGoogle} className="mt-3">
        <input name="next" type="hidden" value={next ?? "/dashboard"} />
        <button className="button button-secondary w-full" type="submit">
          Continue with Google
        </button>
      </form>

      <div className="mt-6 flex justify-between gap-4 text-sm text-slate-300">
        <Link className="underline" href="/forgot-password">
          Forgot password?
        </Link>
        <Link className="underline" href="/signup">
          Create account
        </Link>
      </div>
    </AuthShell>
  );
}
