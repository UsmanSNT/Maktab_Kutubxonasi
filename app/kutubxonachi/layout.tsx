import { Suspense, type ReactNode } from "react";
import { ShellFallback, StaffShell } from "@/components/AppShell";
import { requireStaffArea, shellUser } from "@/lib/auth";

// Butun bo'lim sessiyaga bog'liq: har so'rovda serverda chiziladi.
export const instant = false;

export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: ReactNode }) {
  const user = await requireStaffArea();
  return <StaffShell user={shellUser(user)}>{children}</StaffShell>;
}
