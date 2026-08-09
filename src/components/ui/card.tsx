import type { ReactNode } from "react";
import { cn, surfaces, typography } from "@/lib/ui/styles";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  tone?: "default" | "warning" | "success";
};

const toneClasses = {
  default: surfaces.card,
  warning: "rounded-2xl border border-amber-500/30 bg-amber-950/20",
  success: "rounded-2xl border border-emerald-500/30 bg-emerald-950/20",
};

export function Card({
  title,
  subtitle,
  children,
  className,
  tone = "default",
}: CardProps) {
  return (
    <section className={cn(toneClasses[tone], surfaces.cardPadding, className)}>
      {title ? <h2 className={typography.sectionTitle}>{title}</h2> : null}
      {subtitle ? <p className={typography.sectionSubtitle}>{subtitle}</p> : null}
      {children}
    </section>
  );
}
