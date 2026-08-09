"use server";

import { CHICAGO_TRIP_ID } from "@/lib/constants";
import {
  buildDocumentStoragePath,
  TRIP_DOCUMENTS_BUCKET,
  validatePlaceDocumentFile,
  type PlaceDocumentListItem,
} from "@/lib/places/place-documents";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

const SIGNED_URL_EXPIRY_SECONDS = 60;

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function assertPlaceInTrip(
  supabase: Awaited<ReturnType<typeof createClient>>,
  placeId: string,
): Promise<ActionResult> {
  const { data, error } = await supabase
    .from("places")
    .select("id")
    .eq("id", placeId)
    .eq("trip_id", CHICAGO_TRIP_ID)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return { ok: false, error: "Lugar no encontrado." };
  }

  return { ok: true };
}

export async function listPlaceDocumentsAction(
  placeId: string,
): Promise<ActionResult<PlaceDocumentListItem[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const placeCheck = await assertPlaceInTrip(supabase, placeId);
  if (!placeCheck.ok) {
    return placeCheck;
  }

  const { data, error } = await supabase
    .from("place_documents")
    .select("id, file_name, file_type, created_at")
    .eq("place_id", placeId)
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, data: data ?? [] };
}

export async function uploadPlaceDocumentAction(
  formData: FormData,
): Promise<ActionResult<PlaceDocumentListItem>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const placeId = String(formData.get("placeId") ?? "").trim();
  const fileEntry = formData.get("file");

  if (!placeId) {
    return { ok: false, error: "Falta el lugar." };
  }

  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return { ok: false, error: "Selecciona un archivo para subir." };
  }

  const validation = validatePlaceDocumentFile(fileEntry);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }

  const placeCheck = await assertPlaceInTrip(supabase, placeId);
  if (!placeCheck.ok) {
    return placeCheck;
  }

  const storagePath = buildDocumentStoragePath(placeId, fileEntry.name);

  const { error: uploadError } = await supabase.storage
    .from(TRIP_DOCUMENTS_BUCKET)
    .upload(storagePath, fileEntry, {
      contentType: validation.mimeType,
      upsert: false,
    });

  if (uploadError) {
    return { ok: false, error: uploadError.message };
  }

  const { data: inserted, error: insertError } = await supabase
    .from("place_documents")
    .insert({
      place_id: placeId,
      file_name: fileEntry.name,
      storage_path: storagePath,
      file_type: validation.mimeType,
      uploaded_by: user.id,
    })
    .select("id, file_name, file_type, created_at")
    .single();

  if (insertError) {
    await supabase.storage.from(TRIP_DOCUMENTS_BUCKET).remove([storagePath]);
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/planificar");
  return { ok: true, data: inserted };
}

export async function getPlaceDocumentSignedUrlAction(
  documentId: string,
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data: document, error: documentError } = await supabase
    .from("place_documents")
    .select("id, storage_path, place_id, places!inner(trip_id)")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    return { ok: false, error: documentError.message };
  }

  if (!document) {
    return { ok: false, error: "Documento no encontrado." };
  }

  const placeJoin = document.places as { trip_id: string } | { trip_id: string }[];
  const tripId = Array.isArray(placeJoin) ? placeJoin[0]?.trip_id : placeJoin?.trip_id;

  if (tripId !== CHICAGO_TRIP_ID) {
    return { ok: false, error: "Documento no válido para este viaje." };
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from(TRIP_DOCUMENTS_BUCKET)
    .createSignedUrl(document.storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signedError || !signed?.signedUrl) {
    return {
      ok: false,
      error: signedError?.message ?? "No se pudo generar el enlace de descarga.",
    };
  }

  return { ok: true, data: { url: signed.signedUrl } };
}

export async function deletePlaceDocumentAction(
  documentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data: document, error: documentError } = await supabase
    .from("place_documents")
    .select("id, storage_path, place_id, places!inner(trip_id)")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    return { ok: false, error: documentError.message };
  }

  if (!document) {
    return { ok: false, error: "Documento no encontrado." };
  }

  const placeJoin = document.places as { trip_id: string } | { trip_id: string }[];
  const tripId = Array.isArray(placeJoin) ? placeJoin[0]?.trip_id : placeJoin?.trip_id;

  if (tripId !== CHICAGO_TRIP_ID) {
    return { ok: false, error: "Documento no válido para este viaje." };
  }

  const { error: storageError } = await supabase.storage
    .from(TRIP_DOCUMENTS_BUCKET)
    .remove([document.storage_path]);

  if (storageError) {
    return { ok: false, error: storageError.message };
  }

  const { error: deleteError } = await supabase
    .from("place_documents")
    .delete()
    .eq("id", documentId);

  if (deleteError) {
    return { ok: false, error: deleteError.message };
  }

  revalidatePath("/planificar");
  return { ok: true };
}
