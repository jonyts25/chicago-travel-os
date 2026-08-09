import type { ReactNode } from "react";
import { cn, surfaces, typography } from "@/lib/ui/styles";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        surfaces.inset,
        "flex flex-col items-center px-4 py-8 text-center",
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-700 bg-slate-950 text-blue-400">
        {icon ?? <DefaultEmptyIcon />}
      </div>
      <h3 className={cn(typography.sectionTitle, "mt-4")}>{title}</h3>
      <p className={cn(typography.secondary, "mt-2 max-w-sm")}>{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

function DefaultEmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 7h16M4 12h10M4 17h14" strokeLinecap="round" />
    </svg>
  );
}
