"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BookDown,
  BookUp,
  CalendarClock,
  House,
  IdCard,
  Inbox,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Menu,
  ScanLine,
  Settings,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Avatar, cn } from "./ui";

export type ShellUser = {
  name: string;
  initials: string;
  schoolName: string;
  roleLabel: string;
  isCirculator: boolean;
};

type NavItem = { href: string; label: string; icon: LucideIcon; show?: boolean };

function staffNav(u: ShellUser): NavItem[] {
  return [
    { href: "/kutubxonachi", label: "Bosh panel", icon: LayoutDashboard },
    { href: "/kutubxonachi/berish", label: "Kitob berish", icon: BookUp, show: u.isCirculator },
    { href: "/kutubxonachi/qabul", label: "Qabul qilish", icon: BookDown, show: u.isCirculator },
    { href: "/kutubxonachi/sorovlar", label: "So'rovlar", icon: Inbox, show: u.isCirculator },
    { href: "/kutubxonachi/qarzlar", label: "Qarzlar", icon: CalendarClock },
    { href: "/kutubxonachi/kitoblar", label: "Kitoblar", icon: Library },
    { href: "/kutubxonachi/oquvchilar", label: "O'quvchilar", icon: Users },
    { href: "/kutubxonachi/reyting", label: "Reyting", icon: Trophy },
    { href: "/kutubxonachi/sozlamalar", label: "Sozlamalar", icon: Settings },
  ].filter((i) => i.show !== false);
}

const readerNav: NavItem[] = [
  { href: "/o-quvchi", label: "Bosh sahifa", icon: House },
  { href: "/o-quvchi/katalog", label: "Katalog", icon: Library },
  { href: "/o-quvchi/skaner", label: "Skaner", icon: ScanLine },
  { href: "/o-quvchi/testlar", label: "Testlar", icon: ListChecks },
  { href: "/o-quvchi/reyting", label: "Reyting", icon: Trophy },
];

function isActive(path: string, href: string, root: string) {
  return href === root ? path === root : path === href || path.startsWith(`${href}/`);
}

function Brand({ school }: { school: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 place-items-center rounded-xl bg-gold-500 text-brand-900 shadow-sm">
        <Library className="size-5" strokeWidth={2.4} />
      </span>
      <div className="min-w-0 leading-tight">
        <p className="font-bold text-white">Kutubxona</p>
        <p className="truncate text-xs text-brand-200">{school}</p>
      </div>
    </div>
  );
}

function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className={cn("inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium", className)}
        title="Chiqish"
      >
        <LogOut className="size-4" />
        <span>Chiqish</span>
      </button>
    </form>
  );
}

export function StaffShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const items = staffNav(user);

  const nav = (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(path, item.href, "/kutubxonachi");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
              active ? "bg-white/12 text-white shadow-inner" : "text-brand-100/85 hover:bg-white/6 hover:text-white",
            )}
          >
            <item.icon className={cn("size-[18px]", active ? "text-gold-400" : "text-brand-200")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const userBox = (
    <div className="rounded-2xl bg-white/6 p-3">
      <div className="flex items-center gap-3">
        <Avatar text={user.initials} className="bg-gold-500 text-brand-900" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{user.name}</p>
          <p className="truncate text-xs text-brand-200">{user.roleLabel}</p>
        </div>
      </div>
      <LogoutButton className="mt-2 w-full text-brand-100 hover:bg-white/8 hover:text-white" />
    </div>
  );

  return (
    <div className="flex min-h-full flex-1">
      {/* Kompyuter: yon panel */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-66 flex-col justify-between bg-brand-900 p-4 lg:flex">
        <div className="space-y-7">
          <div className="px-1 pt-1">
            <Brand school={user.schoolName} />
          </div>
          {nav}
        </div>
        {userBox}
      </aside>

      {/* Telefon: yuqori panel va tortma menyu */}
      <div className="no-print fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between bg-brand-900 px-4 lg:hidden">
        <Brand school={user.schoolName} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid size-10 place-items-center rounded-xl text-white hover:bg-white/10"
          aria-label="Menyu"
        >
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Yopish" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-80 max-w-[85vw] flex-col justify-between bg-brand-900 p-4">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <Brand school={user.schoolName} />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid size-10 place-items-center rounded-xl text-white hover:bg-white/10"
                  aria-label="Yopish"
                >
                  <X className="size-5" />
                </button>
              </div>
              {nav}
            </div>
            {userBox}
          </div>
        </div>
      )}

      <main className="flex-1 px-4 pb-12 pt-22 sm:px-6 lg:ml-66 lg:px-10 lg:pt-10 print:m-0 print:p-0">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

export function ReaderShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const path = usePathname();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/o-quvchi" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-brand-700 text-gold-400">
              <Library className="size-[18px]" strokeWidth={2.4} />
            </span>
            <span className="leading-tight">
              <span className="block font-bold text-ink">Kutubxona</span>
              <span className="block max-w-[40vw] truncate text-xs text-muted">{user.schoolName}</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {readerNav.map((item) => {
              const active = isActive(path, item.href, "/o-quvchi");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                    active ? "bg-brand-700 text-white" : "text-muted hover:bg-white hover:text-ink",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1">
            <Link
              href="/o-quvchi/karta"
              className="grid size-10 place-items-center rounded-xl text-brand-700 hover:bg-white"
              title="Mening kartam"
            >
              <IdCard className="size-5" />
            </Link>
            <LogoutButton className="text-muted hover:bg-white hover:text-ink max-sm:[&>span]:hidden" />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-6 md:pb-12">{children}</main>

      {/* Telefon: pastki navigatsiya */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {readerNav.map((item) => {
            const active = isActive(path, item.href, "/o-quvchi");
            const isScan = item.href === "/o-quvchi/skaner";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold",
                  active ? "text-brand-700" : "text-muted",
                )}
              >
                {isScan ? (
                  <span className="-mt-6 grid size-13 place-items-center rounded-2xl bg-brand-700 text-white shadow-pop ring-4 ring-paper">
                    <item.icon className="size-6" />
                  </span>
                ) : (
                  <item.icon className={cn("size-[22px]", active && "text-brand-700")} />
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function ShellFallback() {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="flex items-center gap-3 text-muted">
        <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" />
        Yuklanmoqda…
      </div>
    </div>
  );
}
