"use server";

import { createTripForUser, normalizeCreateTripType } from "@/lib/trips/create-trip";
import { tripDefaultPath } from "@/lib/trips/trip-paths";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTripAction(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/");
  }

  const tripType = normalizeCreateTripType(formData.get("trip_type"));
  const result = await createTripForUser(supabase, user.id, {
    name: String(formData.get("name") ?? ""),
    tripType,
    city: String(formData.get("city") ?? "") || null,
    startDate: String(formData.get("start_date") ?? "") || null,
    endDate: String(formData.get("end_date") ?? "") || null,
    timezone: String(formData.get("timezone") ?? "") || "America/Chicago",
  });

  if (!result.ok) {
    redirect(`/?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/");
  redirect(tripDefaultPath(result.tripId, tripType));
}
