/**
 * Simulated assistant for the static (published) build: replays answers recorded from the
 * local assistant. A request whose text equals a recording gets that recorded answer; any
 * other text gets the closest recorded example, flagged so the UI can say it is not an
 * assessment of the entered text. No network, no model, no secrets.
 */
type RequirementInput = { id: string; text: string };
export type Recording = { kind: string; payload: unknown; result: unknown };
export type SimulatedMatch = "recorded" | "example";
export type Simulated = { result: unknown; match: SimulatedMatch };

type LoosePayload = {
  title?: string;
  brief?: string;
  requirements?: RequirementInput[];
  answer?: { text: string };
  answers?: { text: string }[];
  legacyAnswer?: string;
  cv?: string;
  profile?: { headline?: string; bio?: string };
};

function normalize(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}
function tokens(text: string) {
  return new Set(
    normalize(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean),
  );
}
/** Jaccard similarity of word sets, 0–1. */
export function similarity(a: string, b: string) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.size || !y.size) return 0;
  let shared = 0;
  for (const t of x) if (y.has(t)) shared += 1;
  return shared / (x.size + y.size - shared);
}
/** Text that identifies a request, without ids (requirement ids are random per session). */
function matchText(payload: LoosePayload) {
  return [
    payload.title,
    payload.brief,
    ...(payload.requirements ?? []).map((r) => r.text),
    payload.answer?.text,
    ...(payload.answers ?? []).map((a) => a.text),
    payload.legacyAnswer,
    payload.cv,
    payload.profile?.headline,
    payload.profile?.bio,
  ]
    .filter(Boolean)
    .join("\n");
}
function closest<T>(items: T[], text: (item: T) => string, wanted: string) {
  let best: { item: T; score: number } | undefined;
  // Later recordings win ties: the file is ordered oldest first.
  for (const item of items) {
    const score = similarity(text(item), wanted);
    if (!best || score >= best.score) best = { item, score };
  }
  if (!best) return undefined;
  return {
    item: best.item,
    match: (normalize(text(best.item)) === normalize(wanted)
      ? "recorded"
      : "example") as SimulatedMatch,
  };
}
/** Each question is matched on its own, so a mixed list still gets per-question verdicts. */
function simulateRequirements(payload: LoosePayload, recordings: Recording[]): Simulated | null {
  const pool = recordings
    .filter((r) => r.kind === "requirements")
    .flatMap((r) => {
      const asked = (r.payload as LoosePayload).requirements ?? [];
      const items = (r.result as { items?: { id: string }[] }).items ?? [];
      return asked.flatMap((q) => {
        const item = items.find((i) => i.id === q.id);
        return item ? [{ text: q.text, item }] : [];
      });
    });
  if (!pool.length) return null;
  let match: SimulatedMatch = "recorded";
  const items = (payload.requirements ?? []).map((q) => {
    const found = closest(pool, (p) => p.text, q.text)!;
    if (found.match === "example") match = "example";
    return { ...found.item.item, id: q.id };
  });
  return { result: { items }, match };
}
export function simulate(
  kind: string,
  payload: unknown,
  recordings: Recording[],
): Simulated | null {
  const wanted = payload as LoosePayload;
  if (kind === "requirements") return simulateRequirements(wanted, recordings);
  const found = closest(
    recordings.filter((r) => r.kind === kind),
    (r) => matchText(r.payload as LoosePayload),
    matchText(wanted),
  );
  if (!found) return null;
  if (kind !== "coverage") return { result: found.item.result, match: found.match };
  // Recorded coverage refers to recorded requirement ids: remap by position to the asked ones.
  const recordedIds = ((found.item.payload as LoosePayload).requirements ?? []).map((r) => r.id);
  const askedIds = (wanted.requirements ?? []).map((r) => r.id);
  const result = found.item.result as { items?: { requirementId: string }[] };
  return {
    match: found.match,
    result: {
      ...result,
      items: (result.items ?? []).flatMap((item) => {
        const requirementId = askedIds[recordedIds.indexOf(item.requirementId)];
        return requirementId ? [{ ...item, requirementId }] : [];
      }),
    },
  };
}
