import { DEFAULT_VISIT_MINUTES, TRAVEL_MINUTES_BETWEEN_STOPS } from "@/lib/itinerary/optimizer/types";

export const DEFAULT_DAY_START_MINUTES = 9 * 60;
export const DAY_END_WARNING_MINUTES = 22 * 60;

export type DayScheduleItemInput = {
  id: string;
  orderIndex: number;
  durationMinutes: number;
  isFixed: boolean;
  fixedStartTime: string | null;
};

export type ComputedItemSchedule = {
  id: string;
  startMinutes: number;
  endMinutes: number;
};

export type DayScheduleResult = {
  schedules: ComputedItemSchedule[];
  warnings: string[];
};

export function calculateDaySchedule(
  items: DayScheduleItemInput[],
  options?: {
    dayStartMinutes?: number;
    travelMinutes?: number;
    dayEndWarningMinutes?: number;
  },
): DayScheduleResult {
  const dayStartMinutes = options?.dayStartMinutes ?? DEFAULT_DAY_START_MINUTES;
  const travelMinutes = options?.travelMinutes ?? TRAVEL_MINUTES_BETWEEN_STOPS;
  const dayEndWarningMinutes =
    options?.dayEndWarningMinutes ?? DAY_END_WARNING_MINUTES;

  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  if (sorted.length === 0) {
    return { schedules: [], warnings: [] };
  }

  const scheduleById = new Map<string, ComputedItemSchedule>();
  const anchors = sorted.filter(
    (item) => item.isFixed && item.fixedStartTime && parseTimeToMinutes(item.fixedStartTime) != null,
  );

  for (const anchor of anchors) {
    const startMinutes = parseTimeToMinutes(anchor.fixedStartTime!)!;
    scheduleById.set(anchor.id, {
      id: anchor.id,
      startMinutes,
      endMinutes: startMinutes + anchor.durationMinutes,
    });
  }

  if (anchors.length === 0) {
    scheduleForward(sorted, 0, sorted.length, dayStartMinutes, travelMinutes, scheduleById);
  } else {
    const firstAnchor = anchors[0];
    const firstAnchorIndex = sorted.findIndex((item) => item.id === firstAnchor.id);

    if (firstAnchorIndex > 0) {
      scheduleBackward(
        sorted,
        0,
        firstAnchorIndex,
        scheduleById.get(firstAnchor.id)!.startMinutes,
        travelMinutes,
        scheduleById,
      );
    }

    for (let anchorIndex = 0; anchorIndex < anchors.length; anchorIndex += 1) {
      const anchor = anchors[anchorIndex];
      const anchorPos = sorted.findIndex((item) => item.id === anchor.id);
      const nextAnchor = anchors[anchorIndex + 1];
      const nextAnchorPos = nextAnchor
        ? sorted.findIndex((item) => item.id === nextAnchor.id)
        : sorted.length;

      const middleStart = anchorPos + 1;
      const middleEnd = nextAnchorPos;

      if (middleStart < middleEnd) {
        scheduleBetweenAnchors(
          sorted,
          middleStart,
          middleEnd,
          scheduleById.get(anchor.id)!,
          nextAnchor ? scheduleById.get(nextAnchor.id)! : null,
          travelMinutes,
          scheduleById,
        );
      }
    }

    const lastAnchor = anchors[anchors.length - 1];
    const lastAnchorIndex = sorted.findIndex((item) => item.id === lastAnchor.id);

    if (lastAnchorIndex < sorted.length - 1) {
      scheduleForward(
        sorted,
        lastAnchorIndex + 1,
        sorted.length,
        scheduleById.get(lastAnchor.id)!.endMinutes + travelMinutes,
        travelMinutes,
        scheduleById,
      );
    }
  }

  const schedules = sorted.map((item) => {
    const existing = scheduleById.get(item.id);
    if (existing) {
      return existing;
    }

    return {
      id: item.id,
      startMinutes: dayStartMinutes,
      endMinutes: dayStartMinutes + item.durationMinutes,
    };
  });

  const warnings = buildScheduleWarnings(
    schedules,
    dayStartMinutes,
    dayEndWarningMinutes,
  );

  return { schedules, warnings };
}

function scheduleForward(
  sorted: DayScheduleItemInput[],
  from: number,
  to: number,
  startAtMinutes: number,
  travelMinutes: number,
  scheduleById: Map<string, ComputedItemSchedule>,
): void {
  let current = startAtMinutes;

  for (let index = from; index < to; index += 1) {
    const item = sorted[index];
    if (scheduleById.has(item.id)) {
      current = scheduleById.get(item.id)!.endMinutes + travelMinutes;
      continue;
    }

    const startMinutes = current;
    const endMinutes = startMinutes + item.durationMinutes;
    scheduleById.set(item.id, { id: item.id, startMinutes, endMinutes });
    current = endMinutes + travelMinutes;
  }
}

function scheduleBackward(
  sorted: DayScheduleItemInput[],
  from: number,
  to: number,
  anchorStartMinutes: number,
  travelMinutes: number,
  scheduleById: Map<string, ComputedItemSchedule>,
): void {
  let nextEnd = anchorStartMinutes - travelMinutes;

  for (let index = to - 1; index >= from; index -= 1) {
    const item = sorted[index];
    if (scheduleById.has(item.id)) {
      continue;
    }

    const endMinutes = nextEnd;
    const startMinutes = endMinutes - item.durationMinutes;
    scheduleById.set(item.id, { id: item.id, startMinutes, endMinutes });
    nextEnd = startMinutes - travelMinutes;
  }
}

function scheduleBetweenAnchors(
  sorted: DayScheduleItemInput[],
  from: number,
  to: number,
  leftAnchor: ComputedItemSchedule,
  rightAnchor: ComputedItemSchedule | null,
  travelMinutes: number,
  scheduleById: Map<string, ComputedItemSchedule>,
): void {
  const middleItems = sorted.slice(from, to).filter((item) => !scheduleById.has(item.id));
  if (middleItems.length === 0) {
    return;
  }

  const forwardStart = leftAnchor.endMinutes + travelMinutes;
  let current = forwardStart;
  const forwardSchedule: ComputedItemSchedule[] = [];

  for (const item of middleItems) {
    const startMinutes = current;
    const endMinutes = startMinutes + item.durationMinutes;
    forwardSchedule.push({ id: item.id, startMinutes, endMinutes });
    current = endMinutes + travelMinutes;
  }

  const fitsBeforeRightAnchor =
    !rightAnchor ||
    forwardSchedule[forwardSchedule.length - 1].endMinutes + travelMinutes <=
      rightAnchor.startMinutes;

  if (fitsBeforeRightAnchor) {
    for (const entry of forwardSchedule) {
      scheduleById.set(entry.id, entry);
    }
    return;
  }

  if (!rightAnchor) {
    for (const entry of forwardSchedule) {
      scheduleById.set(entry.id, entry);
    }
    return;
  }

  let nextEnd = rightAnchor.startMinutes - travelMinutes;
  for (let index = middleItems.length - 1; index >= 0; index -= 1) {
    const item = middleItems[index];
    const endMinutes = nextEnd;
    const startMinutes = endMinutes - item.durationMinutes;
    scheduleById.set(item.id, { id: item.id, startMinutes, endMinutes });
    nextEnd = startMinutes - travelMinutes;
  }
}

function buildScheduleWarnings(
  schedules: ComputedItemSchedule[],
  dayStartMinutes: number,
  dayEndWarningMinutes: number,
): string[] {
  if (schedules.length === 0) {
    return [];
  }

  const warnings: string[] = [];
  const firstStart = schedules[0].startMinutes;
  const lastEnd = schedules[schedules.length - 1].endMinutes;

  if (firstStart < dayStartMinutes) {
    warnings.push("El día podría empezar antes de las 9:00 AM.");
  }

  if (lastEnd > dayEndWarningMinutes) {
    warnings.push("Posible día muy cargado (termina después de las 10:00 PM).");
  }

  return warnings;
}

export function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value?.trim()) {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }

  return hours * 60 + minutes + Math.floor(seconds / 60);
}

export function minutesToTimeValue(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:00`;
}

export function formatScheduleTime(value: string | null | undefined): string {
  const minutes = parseTimeToMinutes(value);
  if (minutes == null) {
    return "";
  }

  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(mins).padStart(2, "0")} ${period}`;
}

export function defaultDurationMinutes(value: number | null | undefined): number {
  if (value != null && value > 0) {
    return value;
  }

  return DEFAULT_VISIT_MINUTES;
}
