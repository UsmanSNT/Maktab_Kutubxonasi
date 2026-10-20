import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireStaffWith } from "@/lib/auth";
import { ReturnFlow } from "./ReturnFlow";

export const metadata: Metadata = { title: "Qabul qilish" };

export default async function ReturnPage() {
  const user = await requireStaffWith((u) => u.isCirculator);
  return (
    <>
      <PageHeader
        title="Kitob qabul qilish"
        description="Qaytarilgan kitob yorlig'ini skaner qiling. Shartlar bajarilgan bo'lsa, o'quvchiga test ochiladi."
      />
      <ReturnFlow verifiesImmediately={user.isLibrarian} />
    </>
  );
}
