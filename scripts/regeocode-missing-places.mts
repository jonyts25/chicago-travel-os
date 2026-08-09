import { CHICAGO_TRIP_ID } from "../src/lib/constants";
import { regeocodeMissingPlaces } from "../src/lib/places/regeocode-missing-places";
import {
  createServiceClient,
  isServiceClientConfigured,
} from "../src/lib/supabase/service";

async function main() {
  if (!isServiceClientConfigured()) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
    process.exit(1);
  }

  const supabase = createServiceClient();
  console.log(`Re-geocoding missing places for trip ${CHICAGO_TRIP_ID}...`);
  console.log(
    `Nominatim User-Agent: ${process.env.NOMINATIM_USER_AGENT ?? "(default)"}`,
  );
  console.log("Rate limit: 1 request/second between places.");
  console.log("---");

  const result = await regeocodeMissingPlaces(supabase, CHICAGO_TRIP_ID);

  console.log(JSON.stringify(result, null, 2));

  if (result.total === 0) {
    console.log("No places without coordinates.");
  } else {
    console.log(
      `Done: ${result.resolved} of ${result.total} resolved${
        result.failed.length > 0 ? ` (${result.failed.length} failed)` : ""
      }.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
