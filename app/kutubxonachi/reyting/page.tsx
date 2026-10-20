import type { Metadata } from "next";
import { Leaderboard, parseBoard } from "@/components/Leaderboard";
import { PageHeader } from "@/components/ui";
import { requireStaffArea } from "@/lib/auth";

export const metadata: Metadata = { title: "Reyting" };

export default async function StaffRatingPage({ searchParams }: { searchParams: Promise<{ board?: string; period?: string }> }) {
  await requireStaffArea();
  const { board, period } = parseBoard(await searchParams);
  return (
    <>
      <PageHeader title="Reyting" description="Eng faol kitobxonlar va sinflar bellashuvi." />
      <Leaderboard base="/kutubxonachi/reyting" board={board} period={period} />
    </>
  );
}
