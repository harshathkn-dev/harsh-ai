import Link from "next/link";

import { signUp } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Create an account"
      description="Your sessions and documents remain isolated by account."
    >
      <AuthMessage error={params.error} message={params.message} />

      <form action={signUp} className="space-y-4">
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
            autoComplete="new-password"
            className="field mt-2"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <button className="button w-full" type="submit">
          Create account
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-300">
        Already registered?{" "}
        <Link className="underline" href="/login">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
