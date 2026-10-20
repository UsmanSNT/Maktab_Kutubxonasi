"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRound, UserPlus } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Input, Select } from "@/components/ui";
import { createPerson, issueCode, type CodeState } from "./actions";

function CodeCard({ state, schoolCode }: { state: CodeState; schoolCode: string }) {
  if (!state.code) return null;
  const pretty = state.code.replace(/(.{4})(.{4})(.{2})/, "$1-$2-$3");
  return (
    <div className="rounded-2xl border border-gold-400/60 bg-gold-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gold-700">Faollashtirish ma&apos;lumotlari</p>
      {state.name && <p className="mt-1 font-semibold text-ink">{state.name}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-muted">Maktab kodi</dt>
          <dd className="font-mono font-bold text-ink">{schoolCode}</dd>
        </div>
        {state.login && (
          <div>
            <dt className="text-muted">ID</dt>
            <dd className="font-mono font-bold text-ink">{state.login}</dd>
          </div>
        )}
        <div className="col-span-2">
          <dt className="text-muted">Bir martalik kod</dt>
          <dd className="font-mono text-2xl font-bold tracking-[0.15em] text-brand-800">{pretty}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-muted">
        Kodni yozib bering. U faqat hozir ko&apos;rinadi va 14 kun amal qiladi. O&apos;quvchi «Hisobni faollashtirish» sahifasida
        o&apos;ziga parol o&apos;rnatadi.
      </p>
    </div>
  );
}

export function CreatePersonForm({
  classes,
  schoolCode,
  defaultClass,
}: {
  classes: { id: string; name: string }[];
  schoolCode: string;
  defaultClass?: string;
}) {
  const [state, action] = useActionState(createPerson, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.code || (state.message && !state.error)) {
      form.current?.querySelectorAll<HTMLInputElement>("input[data-clear]").forEach((i) => (i.value = ""));
    }
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4 p-5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Familiya">
          <Input name="last_name" required data-clear />
        </Field>
        <Field label="Ism">
          <Input name="first_name" required data-clear />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Turi">
          <Select name="kind" defaultValue="student">
            <option value="student">O&apos;quvchi</option>
            <option value="teacher">O&apos;qituvchi</option>
            <option value="staff">Xodim</option>
          </Select>
        </Field>
        <Field label="Sinf">
          <Select name="class_id" defaultValue={defaultClass ?? ""}>
            <option value="">—</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="ID (ixtiyoriy)" hint="Bo'sh qoldirsangiz, 6 xonali ID avtomatik beriladi">
        <Input name="login_id" autoCapitalize="none" pattern="[A-Za-z0-9\-]{3,32}" data-clear />
      </Field>

      {state.error && <p className="text-sm font-medium text-bad-600">{state.error}</p>}
      {state.message && !state.code && !state.error && <p className="text-sm font-medium text-ok-600">{state.message}</p>}
      <CodeCard state={state} schoolCode={schoolCode} />

      <SubmitButton className="w-full" pendingText="Yaratilmoqda…">
        <UserPlus className="size-4" /> Qo&apos;shish
      </SubmitButton>
    </form>
  );
}

export function IssueCodeForm({ profileId, login, schoolCode }: { profileId: string; login: string; schoolCode: string }) {
  const [state, action] = useActionState(issueCode, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="profile_id" value={profileId} />
      {state.error && <p className="text-sm font-medium text-bad-600">{state.error}</p>}
      <CodeCard state={{ ...state, login }} schoolCode={schoolCode} />
      <SubmitButton variant="secondary" className="w-full" pendingText="Yaratilmoqda…">
        <KeyRound className="size-4" /> {state.code ? "Yana yangi kod" : "Faollashtirish kodi berish"}
      </SubmitButton>
      <p className="text-xs text-muted">Parolni unutgan bo&apos;lsa ham shu kod orqali yangi parol o&apos;rnatadi.</p>
    </form>
  );
}
