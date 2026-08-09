"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getUserPreferencesAction(): Promise<
  | { ok: true; preferences: string | null }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { data, error } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, preferences: data?.preferences ?? null };
}

export async function updateUserPreferencesAction(
  preferences: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const normalized = preferences.trim() || null;

  const { data: existing, error: fetchError } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchError) {
    return { ok: false, error: fetchError.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("users")
      .update({ preferences: normalized })
      .eq("id", user.id);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("users").insert({
      id: user.id,
      preferences: normalized,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/preferencias");
  revalidatePath("/planificar");
  revalidatePath("/dashboard");
  return { ok: true };
}
