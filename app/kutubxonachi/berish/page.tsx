import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { requireStaffWith } from "@/lib/auth";
import { IssueFlow } from "./IssueFlow";

export const metadata: Metadata = { title: "Kitob berish" };

export default async function IssuePage() {
  await requireStaffWith((u) => u.isCirculator);
  return (
    <>
      <PageHeader title="Kitob berish" description="O'quvchi kartasi va kitob yorlig'ini skaner qiling, so'ng tasdiqlang." />
      <IssueFlow />
    </>
  );
}
