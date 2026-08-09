"use server";

import type { StoredPushSubscription } from "@/lib/push/schema";
import { assertTripMember, interpretMutationResult } from "@/lib/supabase/mutation-result";
import { createClient } from "@/lib/supabase/server";
import { revalidateTripPaths } from "@/lib/trips/trip-paths";
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
  tripId: string,
  confirmed: boolean,
): Promise<{ ok: true; confirmed: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión." };
  }

  const membership = await assertTripMember(supabase, user.id, tripId);
  if (!membership.ok) {
    return membership;
  }

  const { data, error } = await supabase
    .from("trips")
    .update({ late_checkin_confirmed: confirmed })
    .eq("id", tripId)
    .select("id")
    .single();

  const mutation = interpretMutationResult(data, error, {
    table: "trips",
    action: "update",
    permissionHint:
      "Los miembros del viaje necesitan políticas RLS de SELECT y UPDATE en trips.",
  });

  if (!mutation.ok) {
    return mutation;
  }

  for (const path of revalidateTripPaths(tripId)) {
    revalidatePath(path);
  }
  return { ok: true, confirmed };
}
