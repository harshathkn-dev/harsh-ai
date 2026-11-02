import { updatePassword } from "@/app/auth/actions";
import { AuthMessage } from "@/components/auth-message";
import { AuthShell } from "@/components/auth-shell";

type UpdatePasswordPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    message?: string | string[];
  }>;
};

export default async function UpdatePasswordPage({
  searchParams,
}: UpdatePasswordPageProps) {
  const params = await searchParams;

  return (
    <AuthShell
      title="Choose a new password"
      description="Use at least eight characters and avoid reused passwords."
    >
      <AuthMessage error={params.error} message={params.message} />
      <form action={updatePassword} className="space-y-4">
        <label className="block text-sm font-semibold">
          New password
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
          Update password
        </button>
      </form>
    </AuthShell>
  );
}
