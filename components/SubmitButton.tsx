"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ComponentProps } from "react";
import { buttonClass } from "./ui";

type Props = ComponentProps<"button"> & {
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
  pendingText?: string;
};

export function SubmitButton({ variant, size, pendingText, children, className, ...props }: Props) {
  const { pending } = useFormStatus();
  return (
    <button {...props} type="submit" disabled={pending || props.disabled} className={buttonClass(variant, size, className)}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
