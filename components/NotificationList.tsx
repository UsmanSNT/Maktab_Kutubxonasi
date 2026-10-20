import { Award, Bell, Inbox, TriangleAlert, Undo2, type LucideIcon } from "lucide-react";
import { fmtDateTime } from "@/lib/format";
import { EmptyState, cn } from "./ui";

export type NotificationRow = {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

function describe(n: NotificationRow): { icon: LucideIcon; tone: string; text: string } {
  const p = n.payload ?? {};
  switch (n.kind) {
    case "loan_request":
      return {
        icon: Inbox,
        tone: "bg-brand-50 text-brand-700",
        text: p.kind === "return" ? "Yangi so'rov: o'quvchi kitobni qaytarmoqchi" : "Yangi so'rov: o'quvchi kitob olmoqchi",
      };
    case "milestone":
      return {
        icon: Award,
        tone: "bg-gold-50 text-gold-700",
        text: `Tabriklaymiz! ${p.books} kitob marrasiga yetdingiz: +${p.amount} (jami ${p.total})`,
      };
    case "return_rejected":
      return { icon: Undo2, tone: "bg-bad-50 text-bad-700", text: "Kitob qaytarilishi tasdiqlanmadi. Kutubxonaga murojaat qiling." };
    case "overdue_staff":
      return {
        icon: TriangleAlert,
        tone: "bg-warn-50 text-warn-600",
        text: `${p.borrower_name}: «${p.book_title}» ${p.days_overdue} kun kechikmoqda`,
      };
    case "overdue_self":
      return {
        icon: TriangleAlert,
        tone: "bg-warn-50 text-warn-600",
        text: `«${p.book_title}» kitobini qaytarish muddati ${p.days_overdue} kun o'tdi`,
      };
    default:
      return { icon: Bell, tone: "bg-paper-2 text-muted", text: n.kind };
  }
}

export function NotificationList({ items }: { items: NotificationRow[] }) {
  if (items.length === 0) return <EmptyState icon={Bell} title="Yangi xabar yo'q" />;
  return (
    <ul className="divide-y divide-line/60">
      {items.map((n) => {
        const d = describe(n);
        return (
          <li key={n.id} className="flex items-start gap-3 px-5 py-3">
            <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", d.tone)}>
              <d.icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", n.read_at ? "text-muted" : "font-medium text-ink")}>{d.text}</p>
              <p className="mt-0.5 text-xs text-muted">{fmtDateTime(n.created_at)}</p>
            </div>
            {!n.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-gold-500" />}
          </li>
        );
      })}
    </ul>
  );
}
