import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "teal";
const badgeTones: Record<BadgeTone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-700/15",
  warning: "bg-amber-50 text-amber-800 ring-amber-700/15",
  danger: "bg-rose-50 text-rose-800 ring-rose-700/15",
  teal: "bg-teal-50 text-teal-800 ring-teal-700/15",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "sm" | "md";
};
const buttonVariants = {
  primary:
    "bg-teal-800 text-white shadow-sm hover:bg-teal-900 focus-visible:outline-teal-700",
  secondary:
    "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50 focus-visible:outline-teal-700",
  quiet: "text-stone-700 hover:bg-stone-100 focus-visible:outline-teal-700",
  danger:
    "bg-rose-700 text-white hover:bg-rose-800 focus-visible:outline-rose-700",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 ${size === "sm" ? "px-3 py-2 text-sm" : "px-4 py-2.5 text-sm"} ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  );
}

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "quiet";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${buttonVariants[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}

export function Panel({
  children,
  className = "",
  as: Element = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
}) {
  return (
    <Element
      className={`rounded-2xl border border-stone-200/90 bg-white shadow-[0_8px_28px_-24px_rgba(28,43,39,0.36)] ${className}`}
    >
      {children}
    </Element>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold tracking-[0.17em] text-teal-800 uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-base leading-7 text-stone-600">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function DemoBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className="border-b border-amber-300/60 bg-[#fff8e8] px-4 py-2.5 text-center text-xs leading-5 text-amber-950 sm:text-sm">
      <span className="font-bold">Sample workspace</span> · fictional records
      only · changes stay in this tab’s memory and clear on reload
      {!compact &&
        ". No data is sent, no email is sent, and no referral is submitted."}
    </div>
  );
}

export function Icon({
  name,
  className = "size-5",
  decorative = true,
}: {
  name:
    | "arrow"
    | "chevron"
    | "plus"
    | "search"
    | "briefcase"
    | "users"
    | "check"
    | "external"
    | "spark"
    | "file"
    | "clock";
  className?: string;
  decorative?: boolean;
}) {
  const paths: Record<typeof name, ReactNode> = {
    arrow: <path d="M4 12h16m-7-7 7 7-7 7" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    plus: <path d="M12 5v14m-7-7h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m-13 5h18m-11 0v2h4v-2" />
      </>
    ),
    users: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    external: (
      <>
        <path d="M14 3h7v7m-1-6-9 9" />
        <path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
        <path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />
      </>
    ),
    file: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6m-12 5h8m-8 4h8" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
