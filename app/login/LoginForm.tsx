"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Maktab kodi">
        <input
          name="school"
          defaultValue={state.school}
          autoComplete="organization"
          autoCapitalize="none"
          placeholder="masalan: 12-maktab"
          required
          className={inputClass}
        />
      </Field>

      <Field label="ID raqam">
        <input
          name="login"
          defaultValue={state.login}
          autoComplete="username"
          autoCapitalize="none"
          required
          className={inputClass}
        />
      </Field>

      <Field label="Parol">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>

      {state.error && <Alert>{state.error}</Alert>}

      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-1 w-full")}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Kirilmoqda…" : "Kirish"}
      </button>

      <p className="text-center text-sm text-muted">
        Birinchi marta kiryapsizmi?{" "}
        <Link href="/faollashtirish" className="font-semibold text-brand-700 hover:underline">
          Hisobni faollashtirish
        </Link>
      </p>
    </form>
  );
}
