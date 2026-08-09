export function formatDurationMinutes(minutes: number | null | undefined): string {
  if (minutes == null || minutes <= 0) {
    return "—";
  }

  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? "1 h" : `${hours} h`;
  }

  if (minutes > 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return `${hours} h ${remainder} min`;
  }

  return `${minutes} min`;
}

export function formatCategory(category: string | null | undefined): string {
  return category?.trim() || "Sin categoría";
}
