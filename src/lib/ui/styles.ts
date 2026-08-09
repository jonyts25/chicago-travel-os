/** Shared Tailwind class groups for the app design system. */

export const colors = {
  accent: "text-blue-400",
  accentBg: "bg-blue-600 hover:bg-blue-500",
  success: "text-emerald-400",
  successBg: "bg-emerald-600 hover:bg-emerald-500",
  warning: "text-amber-400",
  warningBorder: "border-amber-500/30 bg-amber-950/20",
  error: "text-red-400",
  errorBorder: "border-red-500/30 bg-red-950/30",
} as const;

export const typography = {
  eyebrow: "text-xs font-semibold uppercase tracking-[0.18em] text-blue-400",
  pageTitle: "text-2xl font-semibold tracking-tight text-white sm:text-3xl",
  pageSubtitle: "mt-2 text-sm leading-relaxed text-slate-400",
  sectionTitle: "text-lg font-semibold text-white",
  sectionSubtitle: "mt-1 text-sm text-slate-400",
  body: "text-sm text-slate-200",
  secondary: "text-sm text-slate-400",
  muted: "text-xs text-slate-500",
  placeName: "text-lg font-semibold text-white",
  placeTime: "text-base font-semibold tabular-nums text-blue-300",
  placeMeta: "text-xs text-slate-500",
} as const;

export const surfaces = {
  page: "min-h-full bg-slate-950 text-slate-100",
  card: "rounded-2xl border border-slate-800 bg-slate-950/80",
  cardPadding: "p-5 sm:p-6",
  inset: "rounded-xl border border-slate-800 bg-slate-900/60",
} as const;

export const inputs = {
  base: "min-h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30",
  label: "flex flex-col gap-2 text-sm font-medium text-slate-200",
} as const;

export const buttons = {
  base: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
  primary: "bg-blue-600 text-white hover:bg-blue-500",
  secondary: "border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500 hover:bg-slate-800",
  success: "bg-emerald-600 text-white hover:bg-emerald-500",
  danger: "border border-red-500/40 bg-red-950/30 text-red-200 hover:bg-red-950/50",
  ghost: "text-slate-300 hover:bg-slate-900 hover:text-white",
  icon: "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-700 text-slate-200 hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50",
} as const;

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
