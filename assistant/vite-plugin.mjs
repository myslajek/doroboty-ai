// Most dev-serwera: przeglądarka → pliki w assistant/exchange → watcher (claude -p) → odpowiedź.
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const exchange = join(root, "exchange");
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/;
const KINDS = new Set(["requirements", "gaps", "coverage"]);

async function alive() {
  try {
    const beat = JSON.parse(await readFile(join(exchange, "watcher.json"), "utf8"));
    return Date.now() - beat.at < 6000;
  } catch {
    return false;
  }
}
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 200_000) reject(new Error("Żądanie za duże"));
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}
async function middleware(req, res, next) {
  const url = req.url ?? "";
  if (!url.startsWith("/__assistant/")) return next();
  try {
    if (req.method === "GET" && url === "/__assistant/status")
      return send(res, 200, { alive: await alive() });
    if (req.method === "POST" && url === "/__assistant/request") {
      const body = JSON.parse(await readBody(req));
      if (!ID.test(body.id ?? "") || !KINDS.has(body.kind))
        return send(res, 400, { error: "Nieprawidłowe żądanie" });
      await mkdir(join(exchange, "requests"), { recursive: true });
      const tmp = join(exchange, "requests", `${body.id}.json.tmp`);
      await writeFile(tmp, JSON.stringify({ id: body.id, kind: body.kind, payload: body.payload }));
      await rename(tmp, join(exchange, "requests", `${body.id}.json`));
      return send(res, 202, { queued: true, alive: await alive() });
    }
    const match = url.match(/^\/__assistant\/response\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,99})$/);
    if (req.method === "GET" && match) {
      try {
        const raw = await readFile(join(exchange, "responses", `${match[1]}.json`), "utf8");
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("cache-control", "no-store");
        return res.end(raw);
      } catch {
        return send(res, 404, { pending: true, alive: await alive() });
      }
    }
    send(res, 404, { error: "Nie znaleziono" });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
export function assistantBridge() {
  return {
    name: "doroboty-assistant-bridge",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}
