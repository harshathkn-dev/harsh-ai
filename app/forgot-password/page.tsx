import Link from "next/link";

import { requestPasswordReset } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Reset your password"
      description="Supabase will send a secure recovery link to your account."
    >
      <AuthMessage error={params.error} message={params.message} />
      <form action={requestPasswordReset} className="space-y-4">
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
        <button className="button w-full" type="submit">
          Send recovery link
        </button>
      </form>
      <Link className="mt-6 block text-sm text-slate-300 underline" href="/login">
        Return to sign in
      </Link>
    </AuthShell>
  );
}
