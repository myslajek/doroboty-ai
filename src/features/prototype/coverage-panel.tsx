import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestAssistant, useAssistantAlive } from "./assistant/client";
import { AssistantStatus } from "./assistant/status";
import { usePrototype } from "./store";
import { MatchScore } from "./match-score";
import {
  coverageSummary,
  type Action,
  type Application,
  type Job,
  type Requirement,
} from "./model";

/** Prośba do asystenta o % pokrycia każdego wymagania; wynik trafia do stanu akcją `coverage`. */
export async function assessCoverage(
  application: Application,
  job: Job,
  run: (action: Action) => boolean,
  options: { waitWhenOffline?: boolean } = {},
) {
  const requirements = (job.requirements ?? []).map((r) => ({ id: r.id, text: r.text }));
  if (!requirements.length) return "skipped" as const;
  const outcome = await requestAssistant(
    "coverage",
    application.answers?.length
      ? {
          requirements,
          answers: application.answers.map((a) => ({
            text: a.text,
            requirementIds: a.requirementIds,
          })),
        }
      : { requirements, legacyAnswer: application.answer },
    options,
  );
  if (outcome.status !== "done") return outcome.status;
  run({
    type: "coverage",
    applicationId: application.id,
    coverage: outcome.result.items.map((item) => ({
      requirementId: item.requirementId,
      aiPercent: Math.round(item.percent),
      aiNote: item.note,
      gaps: item.gaps,
    })),
  });
  return "done" as const;
}
function band(percent: number) {
  return percent >= 80 ? "green" : percent >= 60 ? "yellow" : percent >= 40 ? "orange" : "red";
}
/** Zamiast Match Score dla ofert z wymaganiami: werdykty rekrutera i średnia propozycja asystenta. */
export function CoverageScore({ application, job }: { application: Application; job?: Job }) {
  const summary = coverageSummary(application, job);
  if (!summary) return <MatchScore score={application.score} />;
  const percent = summary.averagePercent;
  return (
    <span
      className="match-score coverage-score"
      data-score-band={percent === null ? undefined : band(percent)}
      data-pending={summary.pending || undefined}
    >
      {summary.confirmed > 0 && `Potwierdzone ${summary.confirmed}/${summary.total} · `}
      {percent === null ? "Asystent: nieocenione" : `Asystent: ${percent}% pokrycia`}
    </span>
  );
}
/** Odpowiedzi kandydata z numerami wymagań, których dotyczą (widok kandydata i rekrutera). */
export function AnswersView({
  application,
  requirements,
}: {
  application: Application;
  requirements: Requirement[];
}) {
  if (!requirements.length) return <p>{application.answer}</p>;
  if (!application.answers?.length)
    return (
      <>
        <p>{application.answer}</p>
        <p className="record-caption">
          Aplikacja bez odpowiedzi do wymagań (wysłana przed ich wprowadzeniem albo starym
          formularzem).
        </p>
      </>
    );
  return (
    <ol className="answers-view">
      {application.answers.map((a, index) => (
        <li key={a.id}>
          <p className="record-caption">
            Odpowiedź {index + 1} · dotyczy wymagań:{" "}
            {a.requirementIds
              .map((id) => requirements.findIndex((r) => r.id === id) + 1)
              .filter((n) => n > 0)
              .join(", ")}
          </p>
          <p>{a.text}</p>
        </li>
      ))}
    </ol>
  );
}
/** Panel rekrutera: dla każdego wymagania % od asystenta z uzasadnieniem i werdykt rekrutera. */
export function CoveragePanel({ application, job }: { application: Application; job: Job }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const alive = useAssistantAlive();
  const requested = useRef(false);
  const requirements = job.requirements ?? [];
  const byId = new Map((application.coverage ?? []).map((c) => [c.requirementId, c]));
  const assessed = requirements.every((r) => byId.get(r.id)?.aiPercent !== undefined);
  const { run } = usePrototype();
  async function assess() {
    setBusy(true);
    setMessage("Asystent ocenia pokrycie…");
    const status = await assessCoverage(application, job, run);
    setBusy(false);
    setMessage(
      status === "done"
        ? "Asystent zaproponował pokrycie. Decyzja należy do Ciebie."
        : status === "offline"
          ? "Asystent wyłączony. Żądanie czeka w kolejce; włącz npm run assistant."
          : status === "error"
            ? "Asystent nie odpowiedział."
            : "",
    );
  }
  useEffect(() => {
    if (!assessed && alive && !requested.current) {
      requested.current = true;
      assess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive, assessed]);
  return (
    <section className="coverage-panel" aria-labelledby="coverage-heading">
      <h2 id="coverage-heading">Pokrycie wymagań</h2>
      <p className="record-caption">
        Asystent proponuje procent i uzasadnienie. Ty decydujesz, czy wymaganie jest pokryte.
      </p>
      <ol className="coverage-list">
        {requirements.map((r, index) => {
          const c = byId.get(r.id);
          return (
            <li key={r.id} className="coverage-row" data-verdict={c?.recruiterVerdict}>
              <p className="coverage-requirement">
                <span className="requirement-number">{index + 1}</span> {r.text}
              </p>
              <div className="coverage-ai">
                {c?.aiPercent === undefined ? (
                  <span className="match-score" data-pending>
                    Asystent: nieocenione
                  </span>
                ) : (
                  <span className="match-score" data-score-band={band(c.aiPercent)}>
                    Asystent: {c.aiPercent}%
                  </span>
                )}
                {c?.aiNote && <p>{c.aiNote}</p>}
                {c?.gaps && c.gaps.length > 0 && (
                  <ul>
                    {c.gaps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div
                className="coverage-verdict"
                role="group"
                aria-label={`Twój werdykt: wymaganie ${index + 1}`}
              >
                {(
                  [
                    ["covers", "Pokrywa"],
                    ["not", "Nie pokrywa"],
                  ] as const
                ).map(([verdict, label]) => {
                  const active = c?.recruiterVerdict === verdict;
                  return (
                    <Button
                      key={verdict}
                      type="button"
                      size="sm"
                      variant={active ? "default" : "outline"}
                      aria-pressed={active}
                      onClick={() =>
                        run({
                          type: "verdict",
                          applicationId: application.id,
                          requirementId: r.id,
                          verdict: active ? undefined : verdict,
                        })
                      }
                    >
                      {label}
                    </Button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
      <div className="record-actions">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={assess}>
          <Sparkles aria-hidden="true" />{" "}
          {assessed ? "Oceń ponownie z asystentem" : "Oceń z asystentem"}
        </Button>
      </div>
      <p role="status" className="record-caption">
        {message}
      </p>
      <AssistantStatus />
    </section>
  );
}
