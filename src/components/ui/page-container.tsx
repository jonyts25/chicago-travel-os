import type { ReactNode } from "react";
import { cn } from "@/lib/ui/styles";

type PageContainerProps = {
  children: ReactNode;
  className?: string;
  size?: "md" | "lg";
};

export function PageContainer({
  children,
  className,
  size = "md",
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-1 flex-col px-4 py-6 sm:py-8",
        size === "md" ? "max-w-3xl" : "max-w-5xl",
        className,
      )}
    >
      {children}
    </div>
  );
}
