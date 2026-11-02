import { Sidebar } from "@/components/dashboard/sidebar";
import { requireAuthenticatedUser } from "@/lib/auth/user";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { supabase, userId, email } = await requireAuthenticatedUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[#07111f]">
      <Sidebar
        email={email ?? "Authenticated user"}
        name={profile?.full_name ?? null}
      />
      <div className="lg:pl-72">
        <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
