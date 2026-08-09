import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { buttons, cn } from "@/lib/ui/styles";

type ButtonVariant = "primary" | "secondary" | "success" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: buttons.primary,
  secondary: buttons.secondary,
  success: buttons.success,
  danger: buttons.danger,
  ghost: buttons.ghost,
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(buttons.base, variantClasses[variant], className)}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
}
