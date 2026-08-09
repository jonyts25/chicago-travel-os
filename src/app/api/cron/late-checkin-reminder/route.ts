import { NextResponse } from "next/server";
import { runLateCheckinReminder } from "@/lib/push/late-checkin-reminder";
import { isServiceClientConfigured } from "@/lib/supabase/service";
import { isWebPushConfigured } from "@/lib/push/web-push-server";

function isAuthorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return false;
  }

  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  if (headerSecret && headerSecret === expected) {
    return true;
  }

  const authorization = request.headers.get("authorization")?.trim();
  if (authorization === `Bearer ${expected}`) {
    return true;
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret")?.trim();
  return querySecret === expected;
}

export async function GET(request: Request) {
  return handleCronRequest(request);
}

export async function POST(request: Request) {
  return handleCronRequest(request);
}

async function handleCronRequest(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isServiceClientConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY no está configurada en el servidor.",
      },
      { status: 500 },
    );
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Faltan NEXT_PUBLIC_VAPID_PUBLIC_KEY o VAPID_PRIVATE_KEY.",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  try {
    const result = await runLateCheckinReminder({ force });
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Error desconocido.",
      },
      { status: 500 },
    );
  }
}
