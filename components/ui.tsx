import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Tugmalar
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger" | "success" | "gold";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 shadow-sm",
  secondary: "bg-white text-ink border border-line hover:bg-paper-2/60",
  ghost: "text-brand-700 hover:bg-brand-50",
  danger: "bg-bad-600 text-white hover:bg-bad-700 shadow-sm",
  success: "bg-ok-600 text-white hover:bg-ok-700 shadow-sm",
  gold: "bg-gold-500 text-brand-900 hover:bg-gold-400 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-13 px-6 text-base gap-2 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string): string {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
    "disabled:pointer-events-none disabled:opacity-55",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

// ---------------------------------------------------------------------------
// Konteynerlar
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div {...props} className={cn("rounded-2xl border border-line/70 bg-white shadow-card", className)} />;
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line/70 px-5 py-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="size-[18px]" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex text-sm font-medium text-brand-700 hover:underline">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </header>
  );
}

// ---------------------------------------------------------------------------
// Ko'rsatkichlar
// ---------------------------------------------------------------------------

type Tone = "brand" | "gold" | "ok" | "bad" | "warn" | "neutral";

const toneBadge: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  gold: "bg-gold-50 text-gold-700 ring-gold-100",
  ok: "bg-ok-50 text-ok-700 ring-ok-600/15",
  bad: "bg-bad-50 text-bad-700 ring-bad-600/15",
  warn: "bg-warn-50 text-warn-600 ring-warn-600/15",
  neutral: "bg-paper-2/70 text-muted ring-line",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        toneBadge[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const toneIcon: Record<Tone, string> = {
  brand: "bg-brand-50 text-brand-700",
  gold: "bg-gold-50 text-gold-700",
  ok: "bg-ok-50 text-ok-700",
  bad: "bg-bad-50 text-bad-700",
  warn: "bg-warn-50 text-warn-600",
  neutral: "bg-paper-2 text-muted",
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: LucideIcon;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <Card className={cn("flex h-full items-start gap-4 p-5", href && "transition-shadow hover:shadow-pop")}>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", toneIcon[tone])}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-brand-500">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-paper-2 text-muted">
        <Icon className="size-6" />
      </span>
      <p className="mt-4 font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "bad", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn("rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset", toneBadge[tone], className)}>
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-paper-2", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function Progress({ value, tone = "brand" }: { value: number; tone?: "brand" | "gold" | "ok" }) {
  const color = tone === "gold" ? "bg-gold-500" : tone === "ok" ? "bg-ok-600" : "bg-brand-600";
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuenow={Math.round(v)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ text, className }: { text: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800",
        className,
      )}
    >
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Forma elementlari
// ---------------------------------------------------------------------------

export const inputClass = cn(
  "h-11 w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink outline-none transition",
  "placeholder:text-muted/60 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15",
);

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cn(inputClass, props.className)} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cn(inputClass, "appearance-auto pr-8", props.className)} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(inputClass, "h-auto min-h-24 py-2.5", props.className)} />;
}

// ---------------------------------------------------------------------------
// Jadval
// ---------------------------------------------------------------------------

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={cn("border-b border-line/70 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line/50 px-5 py-3.5 align-middle", className)}>{children}</td>;
}
