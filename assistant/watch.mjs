#!/usr/bin/env node
// Lokalny asystent DoRoboty.ai: obserwuje assistant/exchange/requests, odpowiada przez `claude -p`.
// Uruchom: npm run assistant (Ctrl+C zatrzymuje). Jednorazowo: node assistant/watch.mjs --once
import { spawn } from "node:child_process";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const requests = join(root, "exchange", "requests");
const responses = join(root, "exchange", "responses");
const heartbeat = join(root, "exchange", "watcher.json");
const promptsDir = join(root, "prompts");
const runtimeCwd = join(homedir(), ".cache", "doroboty-assistant"); // bez CLAUDE.md projektu
const model = process.env.ASSISTANT_MODEL ?? "sonnet";
const once = process.argv.includes("--once");
const kinds = {
  requirements: "wymagania.md",
  propose: "propozycje.md",
  gaps: "braki.md",
  coverage: "pokrycie.md",
};

async function claude(prompt) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", ["-p", "--output-format", "json", "--model", model], {
      cwd: runtimeCwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`claude exit ${code}: ${err.slice(0, 400)}`));
      try {
        const parsed = JSON.parse(out);
        resolve({
          text: String(parsed.result ?? ""),
          cost: parsed.total_cost_usd,
          ms: parsed.duration_api_ms,
        });
      } catch {
        reject(new Error(`claude output is not JSON: ${out.slice(0, 200)}`));
      }
    });
    child.stdin.end(prompt);
  });
}
function parseJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(cleaned.slice(start, end + 1));
}
async function handle(file) {
  const path = join(requests, file);
  const request = JSON.parse(await readFile(path, "utf8"));
  const id = request.id;
  const template = kinds[request.kind];
  const started = Date.now();
  let response;
  if (!template)
    response = {
      id,
      kind: request.kind,
      ok: false,
      error: `Nieznany rodzaj żądania: ${request.kind}`,
    };
  else {
    const prompt = (await readFile(join(promptsDir, template), "utf8")).replace(
      "{{payload}}",
      JSON.stringify(request.payload, null, 2),
    );
    let lastError = "";
    for (let attempt = 1; attempt <= 2 && !response; attempt++) {
      try {
        const { text, cost, ms } = await claude(prompt);
        response = { id, kind: request.kind, ok: true, result: parseJson(text), cost, ms };
      } catch (e) {
        lastError = e.message;
        console.warn(`  próba ${attempt} nieudana: ${lastError}`);
      }
    }
    if (!response) response = { id, kind: request.kind, ok: false, error: lastError };
  }
  response.at = new Date().toISOString();
  const tmp = join(responses, `${id}.json.tmp`);
  await writeFile(tmp, JSON.stringify(response, null, 2));
  await rename(tmp, join(responses, `${id}.json`));
  await rename(path, join(requests, `${file}.done`));
  console.log(
    `${response.ok ? "✓" : "✗"} ${request.kind} ${id} (${((Date.now() - started) / 1000).toFixed(1)} s${response.cost ? `, ${response.cost.toFixed(3)} USD` : ""})`,
  );
}
async function pending() {
  const files = await readdir(requests);
  return files.filter((f) => f.endsWith(".json")).sort();
}
async function main() {
  await mkdir(requests, { recursive: true });
  await mkdir(responses, { recursive: true });
  await mkdir(runtimeCwd, { recursive: true });
  console.log(`Asystent DoRoboty.ai: model ${model}, obserwuję ${requests}`);
  const beat = () => writeFile(heartbeat, JSON.stringify({ at: Date.now(), model }));
  await beat();
  const timer = setInterval(beat, 2000);
  let stop = false;
  const shutdown = () => {
    stop = true;
    clearInterval(timer);
    writeFile(heartbeat, JSON.stringify({ at: 0, model })).finally(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  while (!stop) {
    const files = await pending();
    if (files.length === 0) {
      if (once) break;
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    // najwyżej 3 żądania równolegle
    await Promise.all(files.slice(0, 3).map((f) => handle(f).catch((e) => console.error(e))));
  }
  clearInterval(timer);
  if (once) await writeFile(heartbeat, JSON.stringify({ at: 0, model }));
}
main();
