import { BookOpen } from "lucide-react";
import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-700">
        <BookOpen className="size-8" />
      </span>
      <h1 className="text-2xl font-bold text-ink">Sahifa topilmadi</h1>
      <p className="max-w-sm text-muted">Bu sahifa yo&apos;q yoki uni ko&apos;rishga ruxsatingiz yo&apos;q.</p>
      <LinkButton href="/">Bosh sahifaga</LinkButton>
    </main>
  );
}
