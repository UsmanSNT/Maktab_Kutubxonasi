"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";
import { activateAction, type ActivateState } from "./actions";

const initial: ActivateState = {};

export function ActivateForm() {
  const [state, action, pending] = useActionState(activateAction, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Maktab kodi">
          <input name="school" defaultValue={state.school} autoCapitalize="none" required className={inputClass} />
        </Field>
        <Field label="ID raqam">
          <input name="login" defaultValue={state.login} autoCapitalize="none" required className={inputClass} />
        </Field>
      </div>

      <Field label="Faollashtirish kodi" hint="Kutubxonachi bergan 10 belgili kod">
        <input
          name="code"
          required
          autoCapitalize="characters"
          autoComplete="one-time-code"
          placeholder="ABCD-EF23-GH"
          className={`${inputClass} font-mono uppercase tracking-[0.2em]`}
        />
      </Field>

      <Field label="Yangi parol">
        <input name="password" type="password" autoComplete="new-password" minLength={6} required className={inputClass} />
      </Field>
      <Field label="Parolni takrorlang">
        <input name="confirm" type="password" autoComplete="new-password" minLength={6} required className={inputClass} />
      </Field>

      {state.error && <Alert>{state.error}</Alert>}

      <button type="submit" disabled={pending} className={buttonClass("primary", "lg", "mt-1 w-full")}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Tekshirilmoqda…" : "Faollashtirish va kirish"}
      </button>

      <p className="text-center text-sm text-muted">
        Hisobingiz bormi?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Kirish
        </Link>
      </p>
    </form>
  );
}
