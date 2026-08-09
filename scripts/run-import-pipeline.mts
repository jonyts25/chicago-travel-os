import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runImportPipelineDryRun } from "../src/lib/places/import-places";

async function main() {
  const csvPath = process.argv[2] ?? "fixtures/google-takeout-chicago.sample.csv";
  const absolutePath = resolve(process.cwd(), csvPath);
  const content = readFileSync(absolutePath, "utf8");
  const filename = csvPath.split("/").pop() ?? "import.csv";

  console.log(`Running import pipeline dry-run on: ${absolutePath}`);
  console.log(
    `Nominatim User-Agent: ${process.env.NOMINATIM_USER_AGENT ?? "(default)"}`,
  );
  console.log(
    `Anthropic API: ${process.env.ANTHROPIC_API_KEY ? "configured" : "not configured"}`,
  );
  console.log("---");

  const summary = await runImportPipelineDryRun(content, filename);

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
