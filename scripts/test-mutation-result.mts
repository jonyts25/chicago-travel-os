import assert from "node:assert/strict";
import { interpretMutationResult } from "../src/lib/supabase/mutation-result";

const success = interpretMutationResult({ id: "abc" }, null, {
  table: "trips",
  action: "update",
});
assert.equal(success.ok, true);

const silentFailure = interpretMutationResult(null, null, {
  table: "trips",
  action: "update",
});
assert.equal(silentFailure.ok, false);
if (!silentFailure.ok) {
  assert.match(silentFailure.error, /No se guardó nada en trips/);
}

const explicitError = interpretMutationResult(null, { message: "permission denied" } as never, {
  table: "users",
  action: "upsert",
});
assert.equal(explicitError.ok, false);
if (!explicitError.ok) {
  assert.equal(explicitError.error, "permission denied");
}

console.log("mutation-result checks passed");
