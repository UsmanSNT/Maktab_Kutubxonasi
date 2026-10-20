"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

const inputClass =
  "w-full rounded-xl border border-[#d6cbb0] bg-white px-4 py-3 text-lg text-[#27272a] outline-none focus:border-[#1e3a8a] focus:ring-2 focus:ring-[#1e3a8a]/20";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-1 text-left">
        <span className="font-medium">Maktab kodi</span>
        <input name="school" autoComplete="organization" required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-left">
        <span className="font-medium">ID raqam</span>
        <input name="login" autoComplete="username" required className={inputClass} />
      </label>

      <label className="flex flex-col gap-1 text-left">
        <span className="font-medium">Parol</span>
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </label>

      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-red-700">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-xl bg-[#1e3a8a] px-4 py-4 text-lg font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Kirilmoqda..." : "Kirish"}
      </button>
    </form>
  );
}
