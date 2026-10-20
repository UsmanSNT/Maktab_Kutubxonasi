import { Suspense, type ReactNode } from "react";
import { ReaderShell, ShellFallback } from "@/components/AppShell";
import { requireUser, shellUser } from "@/lib/auth";

export const instant = false;

export default function ReaderLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

// Xodimlar ham o'quvchi sifatida kitob o'qiydi, shuning uchun bu bo'lim hammaga ochiq.
async function Shell({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <ReaderShell user={shellUser(user)}>{children}</ReaderShell>;
}
