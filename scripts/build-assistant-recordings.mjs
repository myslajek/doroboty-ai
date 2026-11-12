// Builds the replay file for the simulated assistant from real local assistant exchanges.
// Input: assistant/exchange/{requests,responses} (git-ignored, written by `npm run assistant`).
// Output: src/features/prototype/assistant/recordings.json, oldest first (later entries win ties).
// Run with `npm run assistant:record`; data is synthetic case material only.
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const exchange = join(root, "assistant", "exchange");
const output = join(root, "src", "features", "prototype", "assistant", "recordings.json");
const KINDS = new Set(["requirements", "propose", "gaps", "coverage"]);

const rows = [];
for (const name of await readdir(join(exchange, "requests"))) {
  if (!/\.json(\.done)?$/.test(name)) continue;
  const request = JSON.parse(await readFile(join(exchange, "requests", name), "utf8"));
  if (!KINDS.has(request.kind)) continue;
  const responsePath = join(exchange, "responses", `${request.id}.json`);
  let response;
  try {
    response = JSON.parse(await readFile(responsePath, "utf8"));
  } catch {
    continue;
  }
  if (!response.ok || !response.result) continue;
  rows.push({
    at: (await stat(responsePath)).mtimeMs,
    kind: request.kind,
    payload: request.payload,
    result: response.result,
  });
}
rows.sort((a, b) => a.at - b.at);
const seen = new Map();
for (const { kind, payload, result } of rows)
  seen.set(JSON.stringify([kind, payload]), { kind, payload, result });
const recordings = [...seen.values()];
await writeFile(output, `${JSON.stringify(recordings, null, 2)}\n`);
const counts = recordings.reduce((acc, r) => ({ ...acc, [r.kind]: (acc[r.kind] ?? 0) + 1 }), {});
console.log(`Wrote ${recordings.length} recordings to ${output}`, counts);
