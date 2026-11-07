import { useEffect, useState } from "react";
import { z } from "zod";
/**
 * Klient lokalnego asystenta „co napisać, nie jak”.
 * Przeglądarka → dev-serwer Vite (assistant/vite-plugin.mjs) → pliki w assistant/exchange
 * → watcher `npm run assistant` (claude -p) → odpowiedź. Bez backendu produktowego i bez klucza API.
 */
type RequirementInput = { id: string; text: string };
export const assistantResults = {
  requirements: z.object({
    items: z.array(
      z.object({
        id: z.string(),
        verdict: z.enum(["concrete", "generic"]),
        note: z.string().default(""),
        suggestion: z.string().optional(),
      }),
    ),
  }),
  propose: z.object({
    items: z.array(z.object({ text: z.string().min(1), why: z.string().default("") })).min(1),
  }),
  gaps: z.object({ gaps: z.array(z.string()).default([]), note: z.string().default("") }),
  coverage: z.object({
    items: z.array(
      z.object({
        requirementId: z.string(),
        percent: z.number().min(0).max(100),
        note: z.string().default(""),
        gaps: z.array(z.string()).default([]),
        consistency: z.enum(["consistent", "conflict", "unknown"]).optional(),
        consistencyNote: z.string().optional(),
      }),
    ),
  }),
};
export type CandidateContext = { profile: { headline: string; bio: string }; cv: string };
export type AssistantKind = keyof typeof assistantResults;
export type AssistantResult<K extends AssistantKind> = z.infer<(typeof assistantResults)[K]>;
export type AssistantPayload = {
  requirements: {
    title: string;
    brief: string;
    requirements: RequirementInput[];
  };
  propose: { title: string; brief: string };
  gaps: {
    requirements: RequirementInput[];
    answer: { text: string; requirementIds: string[] };
  } & Partial<CandidateContext>;
  coverage: {
    requirements: RequirementInput[];
    answers?: { text: string; requirementIds: string[] }[];
    legacyAnswer?: string;
  } & Partial<CandidateContext>;
};
export type AssistantOutcome<K extends AssistantKind> =
  | { status: "done"; result: AssistantResult<K> }
  | { status: "offline" }
  | { status: "error"; message: string };

const responseSchema = z.object({
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
});
const POLL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 120_000;

export async function assistantAlive(signal?: AbortSignal) {
  try {
    const res = await fetch("/__assistant/status", { signal, cache: "no-store" });
    if (!res.ok) return false;
    return Boolean((await res.json()).alive);
  } catch {
    return false;
  }
}
/**
 * Wysyła żądanie i czeka na odpowiedź watchera. Gdy watcher nie działa, żądanie zostaje
 * w kolejce (zrobi je po włączeniu), a funkcja zwraca „offline” zamiast blokować ekran.
 */
export async function requestAssistant<K extends AssistantKind>(
  kind: K,
  payload: AssistantPayload[K],
  options: { signal?: AbortSignal; timeoutMs?: number; waitWhenOffline?: boolean } = {},
): Promise<AssistantOutcome<K>> {
  const id = crypto.randomUUID();
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS, waitWhenOffline = false } = options;
  let alive = false;
  try {
    const res = await fetch("/__assistant/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, kind, payload }),
      signal,
    });
    if (!res.ok) return { status: "error", message: "Most do asystenta odrzucił żądanie." };
    alive = Boolean((await res.json()).alive);
  } catch {
    return { status: "error", message: "Most do asystenta jest dostępny tylko w `npm run dev`." };
  }
  if (!alive && !waitWhenOffline) return { status: "offline" };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) return { status: "error", message: "Przerwano." };
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const res = await fetch(`/__assistant/response/${id}`, { signal, cache: "no-store" });
      if (res.status === 404) {
        if (!waitWhenOffline && !(await res.json()).alive) return { status: "offline" };
        continue;
      }
      const parsed = responseSchema.parse(await res.json());
      if (!parsed.ok)
        return { status: "error", message: parsed.error ?? "Asystent nie odpowiedział." };
      const result = assistantResults[kind].safeParse(parsed.result);
      if (!result.success)
        return { status: "error", message: "Asystent odpowiedział w nieoczekiwanym formacie." };
      return { status: "done", result: result.data as AssistantResult<K> };
    } catch {
      return { status: "error", message: "Nie udało się odczytać odpowiedzi asystenta." };
    }
  }
  return { status: "error", message: "Asystent nie odpowiedział w czasie 2 minut." };
}
/** Czy watcher działa (odświeżane co 3 s). `null` zanim pierwsze sprawdzenie się skończy. */
export function useAssistantAlive() {
  const [alive, setAlive] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer = 0;
    const tick = async () => {
      const next = await assistantAlive(controller.signal);
      if (!controller.signal.aborted) {
        setAlive(next);
        timer = window.setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);
  return alive;
}
