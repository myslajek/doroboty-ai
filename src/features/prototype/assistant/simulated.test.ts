import { describe, expect, it } from "vitest";
import { initialState } from "../model";
import { assistantResults } from "./client";
import recordingsJson from "./recordings.json";
import { simulate, similarity, type Recording } from "./simulated";

const recordings = recordingsJson as Recording[];
const FIXTURE_JOB = "20000000-0000-4000-8000-00000pub3947";

/** Same payload as `assessCoverage` builds for the recruiter view. */
function coveragePayloads() {
  const state = initialState();
  const job = state.jobs.find((j) => j.id === FIXTURE_JOB)!;
  const requirements = (job.requirements ?? []).map((r) => ({ id: r.id, text: r.text }));
  return state.applications
    .filter((a) => a.jobId === FIXTURE_JOB)
    .map((a) => {
      const person = state.people.find((p) => p.id === a.candidateId);
      const context = {
        cv: a.cv,
        profile: { headline: person?.headline ?? "", bio: person?.bio ?? "" },
      };
      return a.answers?.length
        ? {
            requirements,
            answers: a.answers.map((x) => ({ text: x.text, requirementIds: x.requirementIds })),
            ...context,
          }
        : { requirements, legacyAnswer: a.answer, ...context };
    });
}

describe("simulated assistant", () => {
  it("scores identical text 1 and unrelated text 0", () => {
    expect(similarity("Zbudowałam wyszukiwarkę", "zbudowałam   WYSZUKIWARKĘ")).toBe(1);
    expect(similarity("alfa beta", "gamma delta")).toBe(0);
  });

  it("replays a recorded model answer for each of the 20 fixture applications", () => {
    const payloads = coveragePayloads();
    expect(payloads).toHaveLength(20);
    for (const payload of payloads) {
      const found = simulate("coverage", payload, recordings)!;
      expect(found.match).toBe("recorded");
      const result = assistantResults.coverage.parse(found.result);
      expect(result.items.map((i) => i.requirementId)).toEqual(
        payload.requirements.map((r) => r.id),
      );
      expect(result.summary).not.toBe("");
    }
  });

  it("flags new text as an example and remaps requirement ids by position", () => {
    const [first] = coveragePayloads();
    const requirements = first.requirements.map((r, i) => ({ ...r, id: `new-${i}` }));
    const found = simulate(
      "coverage",
      { requirements, legacyAnswer: "Zupełnie nowy tekst, którego nie ma w nagraniach." },
      recordings,
    )!;
    expect(found.match).toBe("example");
    const result = assistantResults.coverage.parse(found.result);
    expect(result.items.map((i) => i.requirementId)).toEqual(requirements.map((r) => r.id));
  });

  it("answers every kind from recordings in the expected shape", () => {
    const propose = simulate(
      "propose",
      { title: "Nowa rola", brief: "Dowolny brief" },
      recordings,
    )!;
    expect(assistantResults.propose.parse(propose.result).items.length).toBeGreaterThan(0);
    expect(propose.match).toBe("example");

    const gaps = simulate(
      "gaps",
      {
        requirements: [{ id: "a", text: "Pytanie" }],
        answer: { text: "Odpowiedź", requirementIds: ["a"] },
      },
      recordings,
    )!;
    expect(assistantResults.gaps.safeParse(gaps.result).success).toBe(true);

    const asked = [
      { id: "q-1", text: "Jakie znasz narzędzia?" },
      { id: "q-2", text: "Opowiedz o projekcie." },
    ];
    const requirements = simulate(
      "requirements",
      { title: "", brief: "", requirements: asked },
      recordings,
    )!;
    expect(assistantResults.requirements.parse(requirements.result).items.map((i) => i.id)).toEqual(
      ["q-1", "q-2"],
    );
  });

  it("returns null when there is nothing recorded for a kind", () => {
    expect(simulate("coverage", { requirements: [] }, [])).toBeNull();
    expect(simulate("requirements", { requirements: [{ id: "a", text: "x" }] }, [])).toBeNull();
  });
});
