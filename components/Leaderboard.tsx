import Link from "next/link";
import { Crown, GraduationCap, Medal, Trophy } from "lucide-react";
import { num, pct } from "@/lib/format";
import { getServerClient } from "@/lib/supabase/server";
import { Card, CardHeader, EmptyState, cn } from "./ui";

// Reyting: shaxsiy (o'quvchilar / o'qituvchilar) va sinflar. Davr: hafta, oy, o'quv yili, butun vaqt.
type Row = {
  place: number;
  profile_id: string;
  display_name: string;
  class_name: string | null;
  books: number;
  tests: number;
  avg_test_bp: number;
  points: number;
  is_me: boolean;
};

type ClassRow = {
  place: number;
  class_id: string;
  class_name: string;
  students: number;
  participants: number;
  books: number;
  class_score: number;
};

export const PERIODS = [
  { key: "week", label: "Hafta" },
  { key: "month", label: "Oy" },
  { key: "year", label: "O'quv yili" },
  { key: "all", label: "Butun vaqt" },
] as const;

export const BOARDS = [
  { key: "students", label: "O'quvchilar" },
  { key: "classes", label: "Sinflar" },
  { key: "teachers", label: "O'qituvchilar" },
] as const;

function periodFrom(period: string): string | null {
  const now = new Date();
  if (period === "week") {
    const d = new Date(now);
    const day = (d.getDay() + 6) % 7; // dushanba = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === "month") return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  if (period === "year") {
    const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    return new Date(y, 8, 1).toISOString();
  }
  return null;
}

function Place({ n }: { n: number }) {
  if (n <= 3) {
    const cls = n === 1 ? "bg-gold-500 text-brand-900" : n === 2 ? "bg-[#cfd6e4] text-brand-900" : "bg-[#e8b98a] text-[#5a3410]";
    return (
      <span className={cn("grid size-9 place-items-center rounded-full font-bold shadow-sm", cls)}>
        {n === 1 ? <Crown className="size-4" /> : n}
      </span>
    );
  }
  return <span className="grid size-9 place-items-center rounded-full bg-paper-2 text-sm font-bold text-muted">{n}</span>;
}

export async function Leaderboard({ base, board, period }: { base: string; board: string; period: string }) {
  const db = await getServerClient();
  const from = periodFrom(period);
  const tab = (k: string, active: boolean, href: string) => (
    <Link
      key={k}
      href={href}
      className={cn(
        "whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
        active ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
      )}
    >
      {k}
    </Link>
  );

  let content;
  if (board === "classes") {
    const { data } = await db.rpc("leaderboard_classes", { p_from: from, p_to: null });
    const rows = (data ?? []) as ClassRow[];
    content =
      rows.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Hali natija yo'q" />
      ) : (
        <ol className="divide-y divide-line/60">
          {rows.map((r) => (
            <li key={r.class_id} className="flex items-center gap-4 px-5 py-3.5">
              <Place n={r.place} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">{r.class_name}</p>
                <p className="text-xs text-muted">
                  {r.participants}/{r.students} o&apos;quvchi qatnashdi · {r.books} kitob
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-brand-700">{Number(r.class_score).toFixed(1)}</p>
                <p className="text-[11px] text-muted">o&apos;rtacha ball</p>
              </div>
            </li>
          ))}
        </ol>
      );
  } else {
    const { data } = await db.rpc("leaderboard", {
      p_kind: board === "teachers" ? "teacher" : "student",
      p_from: from,
      p_to: null,
      p_class_id: null,
      p_limit: 50,
    });
    const rows = (data ?? []) as Row[];
    const podium = rows.filter((r) => r.place <= 3).slice(0, 3);
    content =
      rows.length === 0 ? (
        <EmptyState icon={Trophy} title="Hali natija yo'q" description="Kitob qaytarilib, test ishlanganda reyting shakllanadi." />
      ) : (
        <>
          {podium.length === 3 && (
            <div className="grid grid-cols-3 items-end gap-3 border-b border-line/70 bg-gradient-to-b from-brand-50/60 to-transparent px-5 pb-5 pt-6">
              {[podium[1], podium[0], podium[2]].map((r, i) => (
                <div key={r.profile_id} className="flex flex-col items-center text-center">
                  <Place n={r.place} />
                  <p className="mt-2 line-clamp-1 text-sm font-semibold text-ink">{r.display_name}</p>
                  <p className="text-xs text-muted">{r.class_name ?? ""}</p>
                  <div
                    className={cn(
                      "mt-2 w-full rounded-t-xl bg-brand-700 text-white",
                      i === 1 ? "h-24 bg-brand-800" : i === 0 ? "h-16" : "h-12",
                    )}
                  >
                    <p className="pt-2 text-lg font-bold tabular-nums">{num(r.points)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <ol className="divide-y divide-line/60">
            {rows.map((r) => (
              <li key={r.profile_id} className={cn("flex items-center gap-4 px-5 py-3", r.is_me && "bg-gold-50")}>
                <Place n={r.place} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {r.display_name} {r.is_me && <span className="text-xs font-bold text-gold-700">(siz)</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {r.class_name ? `${r.class_name} · ` : ""}
                    {r.books} kitob · test {pct(r.avg_test_bp)}
                  </p>
                </div>
                <p className="text-lg font-bold tabular-nums text-brand-700">{num(r.points)}</p>
              </li>
            ))}
          </ol>
        </>
      );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-paper-2/70 p-1">
          {BOARDS.map((b) => tab(b.label, board === b.key, `${base}?board=${b.key}&period=${period}`))}
        </div>
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-paper-2/70 p-1">
          {PERIODS.map((p) => tab(p.label, period === p.key, `${base}?board=${board}&period=${p.key}`))}
        </div>
      </div>
      <Card>
        <CardHeader
          icon={board === "classes" ? GraduationCap : Medal}
          title={BOARDS.find((b) => b.key === board)?.label ?? ""}
          description={
            board === "classes"
              ? "Sinf bali = o'quvchilar ballari yig'indisi / sinfdagi barcha o'quvchilar"
              : "Ball = kitob uchun bazaviy ball + test natijasi"
          }
        />
        {content}
      </Card>
    </div>
  );
}

export function parseBoard(sp: { board?: string; period?: string }) {
  return {
    board: BOARDS.some((b) => b.key === sp.board) ? sp.board! : "students",
    period: PERIODS.some((p) => p.key === sp.period) ? sp.period! : "month",
  };
}
