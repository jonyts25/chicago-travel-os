import { cn } from "@/lib/ui/styles";

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-xl bg-slate-800/80", className)}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />
    </div>
  );
}
