import type { Metadata } from "next";
import { AuthLayout } from "@/components/AuthLayout";
import { ActivateForm } from "./ActivateForm";

export const metadata: Metadata = { title: "Hisobni faollashtirish" };

export default function ActivatePage() {
  return (
    <AuthLayout
      title="Hisobni faollashtirish"
      subtitle="Kutubxonachidan olgan bir martalik kod bilan o'zingizga parol o'rnating"
    >
      <ActivateForm />
    </AuthLayout>
  );
}
