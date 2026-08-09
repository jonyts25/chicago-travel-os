import { sendWebPushNotification } from "@/lib/push/web-push-server";
import type { StoredPushSubscription } from "@/lib/push/schema";
import { createServiceClient } from "@/lib/supabase/service";

type TripReminderRow = {
  id: string;
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
    .select("id, hotel_checkin, late_checkin_confirmed")
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

  const today = startOfDay(new Date());
  const eligibleTrips = (trips ?? []).filter((trip) => {
    if (force) {
      return true;
    }

    return isOnOrBeforeCheckinDay(today, (trip as TripReminderRow).hotel_checkin);
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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isOnOrBeforeCheckinDay(today: Date, hotelCheckinIso: string | null): boolean {
  if (!hotelCheckinIso?.trim()) {
    return false;
  }

  const checkinDate = new Date(hotelCheckinIso);
  if (Number.isNaN(checkinDate.getTime())) {
    return false;
  }

  const checkinDay = startOfDay(checkinDate);
  return today.getTime() <= checkinDay.getTime();
}
