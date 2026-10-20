"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import type { FormState } from "@/lib/errors";
import { cn } from "./ui";

/**
 * Server amali bilan forma: xato yoki muvaffaqiyat xabarini forma ichida ko'rsatadi.
 * resetOnSuccess — muvaffaqiyatdan keyin maydonlarni tozalaydi.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  inlineStatus,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  inlineStatus?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state.message && !state.error) ref.current?.reset();
  }, [state, resetOnSuccess]);

  const status = state.error ? (
    <p role="alert" className="text-sm font-medium text-bad-600">
      {state.error}
    </p>
  ) : state.message ? (
    <p className="text-sm font-medium text-ok-600">{state.message}</p>
  ) : null;

  return (
    <form ref={ref} action={formAction} className={cn(className)}>
      {children}
      {inlineStatus ? status : status && <div className="basis-full">{status}</div>}
    </form>
  );
}
