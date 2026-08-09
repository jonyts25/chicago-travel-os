import { cn } from "@/lib/ui/styles";

type SpinnerProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  label?: string;
};

const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-8 w-8 border-[3px]",
};

export function Spinner({ className, size = "md", label = "Cargando" }: SpinnerProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} role="status">
      <span
        aria-hidden="true"
        className={cn(
          "animate-spin rounded-full border-slate-600 border-t-blue-400",
          sizeClasses[size],
        )}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
