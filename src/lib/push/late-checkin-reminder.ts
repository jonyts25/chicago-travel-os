import { sendWebPushNotification } from "@/lib/push/web-push-server";
import type { StoredPushSubscription } from "@/lib/push/schema";
import { getTripDateOnlyString } from "@/lib/trips/trip-time";
import { parseDateOnly } from "@/lib/trips/trip-calendar";
import { createServiceClient } from "@/lib/supabase/service";

type TripReminderRow = {
  id: string;
  timezone: string | null;
  hotel_checkin: string | null;
  late_checkin_confirmed: boolean | null;
};

type TripMemberRow = {
  user_id: string;
};

type PushSubscriptionDbRow = {
  endpoint: string;
  keys: StoredPushSubscription["keys"] | null;
};

export type LateCheckinReminderResult = {
  ok: boolean;
  tripsChecked: number;
  tripsEligible: number;
  notificationsSent: number;
  notificationsFailed: number;
  skippedReason?: string;
  errors: string[];
};

export async function runLateCheckinReminder(options?: {
  force?: boolean;
}): Promise<LateCheckinReminderResult> {
  const supabase = createServiceClient();
  const force = options?.force === true;

  let query = supabase
    .from("trips")
    .select("id, timezone, hotel_checkin, late_checkin_confirmed")
    .not("hotel_checkin", "is", null);

  if (!force) {
    query = query.eq("late_checkin_confirmed", false);
  }

  const { data: trips, error: tripsError } = await query;

  if (tripsError) {
    return {
      ok: false,
      tripsChecked: 0,
      tripsEligible: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      errors: [tripsError.message],
    };
  }

  const eligibleTrips = (trips ?? []).filter((trip) => {
    if (force) {
      return true;
    }

    const row = trip as TripReminderRow;
    const today = parseTripDateOnly(new Date(), row.timezone);
    return isOnOrBeforeCheckinDay(today, row.hotel_checkin, row.timezone);
  });

  if (eligibleTrips.length === 0) {
    return {
      ok: true,
      tripsChecked: trips?.length ?? 0,
      tripsEligible: 0,
      notificationsSent: 0,
      notificationsFailed: 0,
      skippedReason: force
        ? "No hay trips pendientes de late check-in."
        : "Ningún trip cumple la ventana de recordatorio (hoy <= hotel_checkin).",
      errors: [],
    };
  }

  let notificationsSent = 0;
  let notificationsFailed = 0;
  const errors: string[] = [];

  for (const trip of eligibleTrips as TripReminderRow[]) {
    const { data: members, error: membersError } = await supabase
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", trip.id);

    if (membersError) {
      errors.push(membersError.message);
      continue;
    }

    const userIds = ((members ?? []) as TripMemberRow[]).map((member) => member.user_id);
    if (userIds.length === 0) {
      continue;
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, keys")
      .in("user_id", userIds);

    if (subscriptionsError) {
      errors.push(subscriptionsError.message);
      continue;
    }

    for (const row of (subscriptions ?? []) as PushSubscriptionDbRow[]) {
      if (!row.endpoint || !row.keys?.p256dh || !row.keys?.auth) {
        continue;
      }

      try {
        await sendWebPushNotification(
          {
            endpoint: row.endpoint,
            keys: {
              p256dh: row.keys.p256dh,
              auth: row.keys.auth,
            },
          },
          {
            title: "Chicago Travel OS",
            body: "¿Ya confirmaste el late check-in del hotel?",
            url: "/dashboard",
          },
        );
        notificationsSent += 1;
      } catch (error) {
        notificationsFailed += 1;
        errors.push(
          error instanceof Error ? error.message : "Error desconocido al enviar push.",
        );
      }
    }
  }

  return {
    ok: errors.length === 0 || notificationsSent > 0,
    tripsChecked: trips?.length ?? 0,
    tripsEligible: eligibleTrips.length,
    notificationsSent,
    notificationsFailed,
    errors,
  };
}

function parseTripDateOnly(
  input: Date | string,
  timezone?: string | null,
): Date | null {
  const dateOnly = getTripDateOnlyString(input, timezone);
  if (!dateOnly) {
    return null;
  }

  return parseDateOnly(dateOnly);
}

function isOnOrBeforeCheckinDay(
  today: Date | null,
  hotelCheckinIso: string | null,
  timezone?: string | null,
): boolean {
  if (!today || !hotelCheckinIso?.trim()) {
    return false;
  }

  const checkinDay = parseTripDateOnly(hotelCheckinIso, timezone);
  if (!checkinDay) {
    return false;
  }

  return today.getTime() <= checkinDay.getTime();
}
