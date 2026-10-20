import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import { booksById, copiesById } from "@/lib/queries";
import { getServerClient } from "@/lib/supabase/server";
import { RequestScanner } from "./RequestScanner";

export const metadata: Metadata = { title: "Skaner" };

const STATUS = {
  pending: { label: "Kutilmoqda", tone: "warn" },
  approved: { label: "Tasdiqlandi", tone: "ok" },
  rejected: { label: "Rad etildi", tone: "bad" },
  cancelled: { label: "Bekor", tone: "neutral" },
} as const;

export default async function ScanPage() {
  const user = await requireUser();
  const db = await getServerClient();
  const { data } = await db
    .from("loan_requests")
    .select("id, kind, copy_id, status, created_at")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false })
    .limit(10);
  const requests = (data ?? []) as { id: string; kind: string; copy_id: string; status: keyof typeof STATUS; created_at: string }[];
  const copies = await copiesById(db, requests.map((r) => r.copy_id));
  const books = await booksById(db, [...copies.values()].map((c) => c.book_id));

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader title="Skaner" description="Kitob olish yoki qaytarish uchun yorliqni skaner qiling." />
      <RequestScanner />

      {requests.length > 0 && (
        <Card className="mt-6">
          <CardHeader icon={Clock} title="So'nggi so'rovlarim" />
          <ul className="divide-y divide-line/60">
            {requests.map((r) => {
              const copy = copies.get(r.copy_id);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{copy ? books.get(copy.book_id)?.title : "—"}</p>
                    <p className="text-xs text-muted">
                      {r.kind === "borrow" ? "Olish" : "Qaytarish"} · {fmtDateTime(r.created_at)}
                    </p>
                  </div>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
