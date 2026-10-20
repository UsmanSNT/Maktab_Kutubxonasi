import type { Metadata } from "next";
import { AuthLayout } from "@/components/AuthLayout";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Kirish" };

export default function LoginPage() {
  return (
    <AuthLayout title="Xush kelibsiz" subtitle="Maktab kodi va ID raqamingiz bilan kiring">
      <LoginForm />
    </AuthLayout>
  );
}
