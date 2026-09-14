"use client";

import type { ReactNode } from "react";
import {
  PLACE_INTERESTS,
  PLACE_PRIORITIES,
  type PlaceInterest,
  type PlacePriority,
} from "@/lib/places/place-detail";
import { cn, inputs, typography } from "@/lib/ui/styles";

type ChipSize = "default" | "compact";

type PlacePriorityInterestFieldsProps = {
  priority: PlacePriority | "";
  interest: PlaceInterest | "";
  onPriorityChange: (value: PlacePriority) => void;
  onInterestChange: (value: PlaceInterest) => void;
  size?: ChipSize;
  required?: boolean;
  disabled?: boolean;
};

export function PlacePriorityInterestFields({
  priority,
  interest,
  onPriorityChange,
  onInterestChange,
  size = "default",
  required = false,
  disabled = false,
}: PlacePriorityInterestFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <ChipField
        label="Prioridad"
        required={required}
        hint={required && !priority ? "Obligatorio al crear un lugar" : undefined}
      >
        <PriorityChipGroup
          value={priority}
          onChange={onPriorityChange}
          size={size}
          disabled={disabled}
        />
      </ChipField>

      <ChipField
        label="Interés"
        required={required}
        hint={required && !interest ? "¿Para Jonathan, Mercedes o ambos?" : undefined}
      >
        <InterestChipGroup
          value={interest}
          onChange={onInterestChange}
          size={size}
          disabled={disabled}
        />
      </ChipField>
    </div>
  );
}

export function PriorityChipGroup({
  value,
  onChange,
  size = "default",
  disabled = false,
}: {
  value: PlacePriority | "";
  onChange: (value: PlacePriority) => void;
  size?: ChipSize;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Prioridad del lugar"
      className="flex flex-wrap gap-2"
    >
      {PLACE_PRIORITIES.map((option) => (
        <ChipButton
          key={option.value}
          selected={value === option.value}
          disabled={disabled}
          size={size}
          className={cn(
            option.chipClass,
            value === option.value && option.selectedChipClass,
          )}
          onClick={() => onChange(option.value)}
          ariaLabel={option.label}
        >
          {size === "compact" ? option.shortLabel : option.shortLabel}
        </ChipButton>
      ))}
    </div>
  );
}

export function InterestChipGroup({
  value,
  onChange,
  size = "default",
  disabled = false,
}: {
  value: PlaceInterest | "";
  onChange: (value: PlaceInterest) => void;
  size?: ChipSize;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Interés del lugar"
      className="flex flex-wrap gap-2"
    >
      {PLACE_INTERESTS.map((option) => (
        <ChipButton
          key={option.value}
          selected={value === option.value}
          disabled={disabled}
          size={size}
          className={cn(
            option.chipClass,
            value === option.value && option.selectedChipClass,
          )}
          onClick={() => onChange(option.value)}
          ariaLabel={option.label}
        >
          {option.label}
        </ChipButton>
      ))}
    </div>
  );
}

function ChipField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className={inputs.label}>
      <span>
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </span>
      {children}
      {hint ? <p className={cn(typography.muted, "font-normal")}>{hint}</p> : null}
    </div>
  );
}

function ChipButton({
  children,
  selected,
  disabled,
  size,
  className,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  selected: boolean;
  disabled?: boolean;
  size: ChipSize;
  className: string;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border font-medium transition",
        size === "compact"
          ? "min-h-9 px-3 text-xs"
          : "min-h-11 px-4 text-sm",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
}
