import { describe, expect, it } from "vitest";
import { coverageSummary, initialState, transition, type Requirement, type State } from "./model";
const time = "2026-11-06T10:00:00.000Z";
const FIXTURE_JOB = "20000000-0000-4000-8000-00000pub3947";
function as(state: State, id: string) {
  return transition(state, { type: "select_person", id });
}
function requirement(n: number, verdict?: "concrete" | "generic"): Requirement {
  return {
    id: `req-${n}`,
    text: `Wymaganie ${n}`,
    assessment: verdict ? { verdict, note: "test" } : undefined,
  };
}
function newJob(state: State, requirements?: Requirement[]) {
  const employer = state.people.find((x) => x.id === "employer-brightlabs")!;
  return {
    id: "job-new",
    slug: "job-new",
    companyId: employer.companyId!,
    title: "Nowa rola",
    summary: "Podsumowanie nowej roli",
    description: "Opis nowej roli dłuższy niż trzydzieści znaków.",
    category: "build" as const,
    function: "engineering" as const,
    remoteStatus: "remote" as const,
    locations: ["Wrocław"],
    seniority: "mid" as const,
    contract: "employment" as const,
    publicationStatus: "published" as const,
    publishedAt: time,
    expiryAt: "2099-12-31T23:59:59.000Z",
    verificationStatus: "employer_verified" as const,
    requirements,
  };
}
describe("fixture pub-003947", () => {
  it("loads one Build job with 4 concrete requirements and 20 applications", () => {
    const s = initialState();
    const job = s.jobs.find((x) => x.id === FIXTURE_JOB)!;
    expect(job.requirements).toHaveLength(4);
    expect(job.requirements!.every((r) => r.assessment?.verdict === "concrete")).toBe(true);
    const apps = s.applications.filter((x) => x.jobId === FIXTURE_JOB);
    expect(apps).toHaveLength(20);
    expect(apps.filter((x) => x.answers?.length)).toHaveLength(8);
    expect(s.people.filter((x) => x.fixture)).toHaveLength(20);
  });
  it("keeps the example application and old jobs untouched", () => {
    const s = initialState();
    expect(s.applications.find((x) => x.id === "application-example")).toBeDefined();
    expect(s.jobs.filter((x) => !x.requirements).length).toBeGreaterThanOrEqual(6);
  });
});
describe("publication gate", () => {
  it("requires 3 to 5 requirements for a new job", () => {
    const s = as(initialState(), "employer-brightlabs");
    expect(() => transition(s, { type: "publish", job: newJob(s) })).toThrow("od 3 do 5");
    expect(() =>
      transition(s, { type: "publish", job: newJob(s, [requirement(1), requirement(2)]) }),
    ).toThrow("od 3 do 5");
    const ok = transition(s, {
      type: "publish",
      job: newJob(s, [requirement(1), requirement(2), requirement(3)]),
    });
    expect(ok.jobs[0].requirements).toHaveLength(3);
  });
  it("blocks a requirement assessed as generic, allows unassessed ones", () => {
    const s = as(initialState(), "employer-brightlabs");
    expect(() =>
      transition(s, {
        type: "publish",
        job: newJob(s, [requirement(1, "generic"), requirement(2), requirement(3)]),
      }),
    ).toThrow("ogólnik");
    expect(() =>
      transition(s, {
        type: "publish",
        job: newJob(s, [requirement(1, "concrete"), requirement(2), requirement(3)]),
      }),
    ).not.toThrow();
  });
  it("lets an old job without requirements be edited as before", () => {
    const s = as(initialState(), "employer-brightlabs");
    const old = s.jobs.find(
      (x) => x.companyId === "10000000-0000-4000-8000-000000000001" && !x.requirements,
    )!;
    const edited = transition(s, { type: "publish", job: { ...old, title: "Zmieniony tytuł" } });
    expect(edited.jobs.find((x) => x.id === old.id)?.title).toBe("Zmieniony tytuł");
  });
});
describe("answers pinned to requirements", () => {
  const job = (s: State) => s.jobs.find((x) => x.id === FIXTURE_JOB)!;
  it("requires every requirement to have at least one answer", () => {
    const s = as(initialState(), "candidate-anna");
    const base = {
      type: "submit" as const,
      jobId: FIXTURE_JOB,
      notes: "",
      generated: "",
      answer: "",
      consent: true,
    };
    expect(() => transition(s, base, time)).toThrow();
    expect(() =>
      transition(
        s,
        {
          ...base,
          answer: "Odpowiedź wystarczająco długa dla schematu.",
          answers: [
            {
              id: "a1",
              text: "Odpowiedź wystarczająco długa dla schematu.",
              requirementIds: ["req-1"],
            },
          ],
        },
        time,
      ),
    ).toThrow("Brakuje");
    const ids = job(s).requirements!.map((r) => r.id);
    const ok = transition(
      s,
      {
        ...base,
        answer: "Odpowiedź wystarczająco długa dla schematu.",
        answers: [
          {
            id: "a1",
            text: "Jedna odpowiedź może pokryć kilka wymagań naraz.",
            requirementIds: ids,
          },
        ],
      },
      time,
      "application-anna-fixture",
    );
    expect(ok.applications.at(-1)?.answers?.[0].requirementIds).toEqual(ids);
  });
  it("rejects answers pointing at unknown requirements", () => {
    const s = as(initialState(), "candidate-anna");
    expect(() =>
      transition(
        s,
        {
          type: "submit",
          jobId: FIXTURE_JOB,
          notes: "",
          generated: "",
          answer: "Odpowiedź wystarczająco długa dla schematu.",
          consent: true,
          answers: [
            {
              id: "a1",
              text: "Odpowiedź wystarczająco długa dla schematu.",
              requirementIds: ["req-9"],
            },
          ],
        },
        time,
      ),
    ).toThrow();
  });
});
describe("coverage: assistant proposes, recruiter decides", () => {
  it("stores assistant coverage and keeps recruiter verdicts across re-assessment", () => {
    let s = as(initialState(), "employer-brightlabs");
    s = transition(s, {
      type: "coverage",
      applicationId: "app-032072",
      coverage: [
        { requirementId: "req-1", aiPercent: 90, aiNote: "Własny komponent", gaps: [] },
        {
          requirementId: "req-2",
          aiPercent: 40,
          aiNote: "Brak zestawu testów",
          gaps: ["zestaw testów"],
        },
      ],
    });
    s = transition(s, {
      type: "verdict",
      applicationId: "app-032072",
      requirementId: "req-2",
      verdict: "covers",
    });
    s = transition(s, {
      type: "coverage",
      applicationId: "app-032072",
      coverage: [{ requirementId: "req-2", aiPercent: 45 }],
    });
    const app = s.applications.find((x) => x.id === "app-032072")!;
    expect(app.coverage).toEqual([
      { requirementId: "req-2", aiPercent: 45, recruiterVerdict: "covers" },
    ]);
    const summary = coverageSummary(
      app,
      s.jobs.find((x) => x.id === FIXTURE_JOB),
    )!;
    expect(summary).toMatchObject({
      total: 4,
      confirmed: 1,
      assessed: 1,
      averagePercent: 45,
      pending: true,
    });
  });
  it("is employer-only and scoped to the company", () => {
    const candidate = as(initialState(), "candidate-anna");
    expect(() =>
      transition(candidate, {
        type: "verdict",
        applicationId: "app-032072",
        requirementId: "req-1",
        verdict: "not",
      }),
    ).toThrow("pracodawcy");
    const other = as(initialState(), "employer-northstar");
    expect(() =>
      transition(other, {
        type: "verdict",
        applicationId: "app-032072",
        requirementId: "req-1",
        verdict: "not",
      }),
    ).toThrow("Nie znaleziono");
  });
  it("returns null for jobs without requirements", () => {
    const s = initialState();
    const example = s.applications.find((x) => x.id === "application-example")!;
    expect(
      coverageSummary(
        example,
        s.jobs.find((x) => x.id === example.jobId),
      ),
    ).toBeNull();
  });
});
