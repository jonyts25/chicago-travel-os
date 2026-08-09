"use client";

import { useState } from "react";
import { cn, colors, typography } from "@/lib/ui/styles";

type ErrorMessageProps = {
  message?: string;
  technicalDetails?: string | null;
  className?: string;
};

export function ErrorMessage({
  message = "Algo salió mal. Intenta de nuevo.",
  technicalDetails,
  className,
}: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);
  const details = technicalDetails?.trim();

  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border px-4 py-3",
        colors.errorBorder,
        className,
      )}
    >
      <p className="text-sm text-red-200">{message}</p>
      {details ? (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowDetails((value) => !value)}
            className={cn(typography.muted, "text-left underline-offset-2 hover:underline")}
          >
            {showDetails ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
          </button>
          {showDetails ? (
            <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950/80 p-3 text-xs text-red-200/90">
              {details}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
