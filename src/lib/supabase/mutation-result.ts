import type { PostgrestError } from "@supabase/supabase-js";

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type MutationOptions = {
  table: string;
  action: "insert" | "update" | "upsert";
  permissionHint?: string;
};

export function interpretMutationResult<T>(
  data: T | null,
  error: PostgrestError | null,
  options: MutationOptions,
): MutationResult<T> {
  if (error) {
    return { ok: false, error: error.message };
  }

  if (data == null) {
    const permissionHint =
      options.permissionHint ??
      "Verifica políticas RLS (SELECT + INSERT/UPDATE) en Supabase.";

    return {
      ok: false,
      error: `No se guardó nada en ${options.table} (${options.action}). ${permissionHint}`,
    };
  }

  return { ok: true, data };
}

export async function assertTripMember(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createClient>>,
  userId: string,
  tripId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from("trip_members")
    .select("user_id")
    .eq("trip_id", tripId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  if (!data) {
    return {
      ok: false,
      error:
        "Tu usuario no está registrado como miembro del viaje (trip_members). Agrega tu user_id al viaje en Supabase antes de guardar.",
    };
  }

  return { ok: true };
}
