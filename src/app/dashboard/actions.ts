"use server";

import { CHICAGO_TRIP_ID } from "@/lib/constants";
import type { StoredPushSubscription } from "@/lib/push/schema";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function getPushSubscriptionStatusAction(): Promise<
  | { ok: true; hasSubscription: boolean }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, hasSubscription: (count ?? 0) > 0 };
}

export async function savePushSubscriptionAction(
  subscription: StoredPushSubscription,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  if (!subscription.endpoint?.trim()) {
    return { ok: false, error: "Suscripción push inválida." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", user.id)
    .eq("endpoint", subscription.endpoint)
    .maybeSingle();

  if (existingError) {
    return { ok: false, error: existingError.message };
  }

  if (existing) {
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ keys: subscription.keys })
      .eq("id", existing.id);

    if (error) {
      return { ok: false, error: error.message };
    }
  } else {
    const { error } = await supabase.from("push_subscriptions").insert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
  }

  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateLateCheckinConfirmedAction(
  confirmed: boolean,
): Promise<{ ok: true; confirmed: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const { error } = await supabase
    .from("trips")
    .update({ late_checkin_confirmed: confirmed })
    .eq("id", CHICAGO_TRIP_ID);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { ok: true, confirmed };
}
