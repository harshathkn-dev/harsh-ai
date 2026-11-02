"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { signOut } from "@/app/auth/actions";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: "O" },
  { href: "/dashboard/sessions", label: "Call Sessions", icon: "S" },
  { href: "/dashboard/documents", label: "Documents", icon: "D" },
  { href: "/dashboard/usage", label: "AI Usage", icon: "U" },
  { href: "/dashboard/settings", label: "Settings", icon: "G" },
];

type SidebarProps = {
  email: string;
  name: string | null;
};

function NavigationLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="Dashboard navigation">
      {navigation.map((item) => {
        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);

        return (
          <Link
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-emerald-300/12 text-emerald-200"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
            href={item.href}
            key={item.href}
            onClick={onNavigate}
          >
            <span
              className={`grid size-8 place-items-center rounded-lg text-xs ${
                active
                  ? "bg-emerald-300 text-slate-950"
                  : "border border-white/10 bg-white/5"
              }`}
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Account({ email, name }: SidebarProps) {
  const initial = (name || email).charAt(0).toUpperCase();

  return (
    <div className="border-t border-white/10 pt-4">
      <div className="flex min-w-0 items-center gap-3 px-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-300 to-cyan-400 font-black text-slate-950">
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{name || "Harsh's AI user"}</p>
          <p className="truncate text-xs text-slate-500">{email}</p>
        </div>
      </div>
      <form action={signOut} className="mt-3">
        <button
          className="w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-slate-400 transition hover:bg-red-400/10 hover:text-red-200"
          type="submit"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

export function Sidebar({ email, name }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#07111f]/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link className="font-black tracking-tight" href="/dashboard">
          Harsh&apos;s <span className="text-emerald-300">AI</span>
        </Link>
        <button
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="grid size-10 place-items-center rounded-xl border border-white/10 bg-white/5"
          onClick={() => setOpen((value) => !value)}
          type="button"
        >
          {open ? "×" : "☰"}
        </button>
      </header>

      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-white/10 bg-[#091522] p-5 transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link className="px-2 text-xl font-black tracking-tight" href="/dashboard">
          Harsh&apos;s <span className="text-emerald-300">AI</span>
        </Link>
        <p className="mb-8 mt-1 px-2 text-xs uppercase tracking-[0.2em] text-slate-600">
          Intelligent workspace
        </p>
        <div className="flex-1">
          <NavigationLinks onNavigate={() => setOpen(false)} />
        </div>
        <Account email={email} name={name} />
      </aside>
    </>
  );
}
