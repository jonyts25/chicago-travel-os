export const TRIP_DOCUMENTS_BUCKET = "trip-documents" as const;

export const MAX_PLACE_DOCUMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_PLACE_DOCUMENT_EXTENSIONS = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".pkpass",
] as const;

export const ALLOWED_PLACE_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.apple.pkpass",
  "application/octet-stream",
] as const;

export type PlaceDocumentListItem = {
  id: string;
  file_name: string;
  file_type: string | null;
  created_at: string;
};

export type PlaceDocumentValidationResult =
  | { ok: true; extension: string; mimeType: string }
  | { ok: false; error: string };

function getFileExtension(fileName: string): string {
  const match = fileName.trim().toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function isAllowedExtension(extension: string): boolean {
  return ALLOWED_PLACE_DOCUMENT_EXTENSIONS.includes(
    extension as (typeof ALLOWED_PLACE_DOCUMENT_EXTENSIONS)[number],
  );
}

function isAllowedMimeType(mimeType: string, extension: string): boolean {
  if (!mimeType) {
    return isAllowedExtension(extension);
  }

  if (mimeType === "application/octet-stream") {
    return isAllowedExtension(extension);
  }

  return ALLOWED_PLACE_DOCUMENT_MIME_TYPES.includes(
    mimeType as (typeof ALLOWED_PLACE_DOCUMENT_MIME_TYPES)[number],
  );
}

export function sanitizeDocumentFileName(fileName: string): string {
  const baseName = fileName.split(/[/\\]/).pop()?.trim() || "documento";
  const sanitized = baseName
    .replace(/[^\w.\-() áéíóúñÁÉÍÓÚÑ]/gi, "_")
    .replace(/_+/g, "_")
    .slice(0, 180);

  return sanitized || "documento";
}

export function buildDocumentStoragePath(placeId: string, fileName: string): string {
  return `${placeId}/${Date.now()}-${sanitizeDocumentFileName(fileName)}`;
}

export function validatePlaceDocumentFile(file: File): PlaceDocumentValidationResult {
  if (file.size > MAX_PLACE_DOCUMENT_SIZE_BYTES) {
    return {
      ok: false,
      error: "El archivo supera el límite de 10 MB.",
    };
  }

  const extension = getFileExtension(file.name);
  if (!isAllowedExtension(extension)) {
    return {
      ok: false,
      error: "Tipo no permitido. Usa PDF, PNG, JPG o .pkpass.",
    };
  }

  const mimeType = file.type.trim().toLowerCase();
  if (!isAllowedMimeType(mimeType, extension)) {
    return {
      ok: false,
      error: "Tipo de archivo no válido para este formato.",
    };
  }

  return {
    ok: true,
    extension,
    mimeType: mimeType || guessMimeTypeFromExtension(extension),
  };
}

function guessMimeTypeFromExtension(extension: string): string {
  switch (extension) {
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".pkpass":
      return "application/vnd.apple.pkpass";
    default:
      return "application/octet-stream";
  }
}

export function formatDocumentCreatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
