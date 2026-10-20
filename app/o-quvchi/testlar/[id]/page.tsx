import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getServerClient } from "@/lib/supabase/server";
import { QuizRunner } from "./QuizRunner";

export const metadata: Metadata = { title: "Test" };

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const db = await getServerClient();
  const { data: attempt } = await db.from("quiz_attempts").select("id, book_id").eq("id", id).eq("student_id", user.id).maybeSingle();
  if (!attempt) notFound();
  const { data: book } = await db.from("books").select("title").eq("id", attempt.book_id).maybeSingle();

  return (
    <div className="mx-auto max-w-2xl">
      <QuizRunner attemptId={id} bookTitle={(book?.title as string) ?? "Kitob"} />
    </div>
  );
}
