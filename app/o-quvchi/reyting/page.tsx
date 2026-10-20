import type { Metadata } from "next";
import { Leaderboard, parseBoard } from "@/components/Leaderboard";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Reyting" };

export default async function ReaderRatingPage({ searchParams }: { searchParams: Promise<{ board?: string; period?: string }> }) {
  await requireUser();
  const { board, period } = parseBoard(await searchParams);
  return (
    <>
      <PageHeader title="Reyting" description="Ko'proq o'qing, testlarni yaxshi ishlang — yuqoriga ko'tariling!" />
      <Leaderboard base="/o-quvchi/reyting" board={board} period={period} />
    </>
  );
}
