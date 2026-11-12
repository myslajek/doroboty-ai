import { useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { EXAMPLE_NOTICE, requestAssistant } from "./assistant/client";
import { AssistantStatus } from "./assistant/status";
import { MIN_APPLICATION_ANSWER_LENGTH, type Answer, type Requirement } from "./model";

export type DraftAnswer = { id: string; text: string; requirementIds: string[] };
export function newAnswer(requirementIds: string[] = []): DraftAnswer {
  return { id: `ans-${crypto.randomUUID().slice(0, 8)}`, text: "", requirementIds };
}
/** Odpowiedzi gotowe do wysłania: tylko wypełnione, z przyciętym tekstem. */
export function finalizeAnswers(answers: DraftAnswer[]): Answer[] {
  return answers
    .filter((a) => a.text.trim())
    .map((a) => ({ id: a.id, text: a.text.trim(), requirementIds: a.requirementIds }));
}
export function uncoveredRequirements(requirements: Requirement[], answers: DraftAnswer[]) {
  const covered = new Set(answers.filter((a) => a.text.trim()).flatMap((a) => a.requirementIds));
  return requirements.filter((r) => !covered.has(r.id));
}
/**
 * Kandydat opisuje przykłady z własnej pracy i sam zaznacza, których wymagań dotyczy każdy.
 * Asystent mówi, czego brakuje (projekt, okres, własna rola, efekt); nie pisze za kandydata.
 */
export function AnswersEditor({
  requirements,
  value,
  onChange,
  disabled = false,
  attempted = false,
  candidate,
}: {
  requirements: Requirement[];
  value: DraftAnswer[];
  onChange: (next: DraftAnswer[]) => void;
  disabled?: boolean;
  attempted?: boolean;
  /** Profil i CV kandydata: asystent sprawdza spójność odpowiedzi z nimi. */
  candidate?: { headline: string; bio: string; cv: string };
}) {
  const [gaps, setGaps] = useState<
    Record<string, { gaps: string[]; note: string } | "busy" | "offline">
  >({});
  const uncovered = uncoveredRequirements(requirements, value);
  function update(id: string, patch: Partial<DraftAnswer>) {
    onChange(value.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }
  async function check(answer: DraftAnswer) {
    setGaps((g) => ({ ...g, [answer.id]: "busy" }));
    const outcome = await requestAssistant("gaps", {
      requirements: requirements
        .filter((r) => answer.requirementIds.includes(r.id))
        .map((r) => ({ id: r.id, text: r.text })),
      answer: { text: answer.text.trim(), requirementIds: answer.requirementIds },
      ...(candidate && {
        cv: candidate.cv,
        profile: { headline: candidate.headline, bio: candidate.bio },
      }),
    });
    setGaps((g) => ({
      ...g,
      [answer.id]:
        outcome.status === "done"
          ? outcome.simulated === "example"
            ? { ...outcome.result, note: `${EXAMPLE_NOTICE} ${outcome.result.note}` }
            : outcome.result
          : outcome.status === "offline"
            ? "offline"
            : { gaps: [], note: outcome.message },
    }));
  }
  return (
    <section className="application-form-section answers-editor" aria-labelledby="answers-title">
      <h3 id="answers-title">Odpowiedzi na pytania pracodawcy</h3>
      <p className="application-help">
        Pracodawca zadał {requirements.length} pytania o zadania z przeszłości. Odpowiedz przykładem
        z własnej pracy: jaki projekt, w jakim okresie, co zrobiłeś/aś sam/a, co robili inni i jaki
        był efekt. Jedna odpowiedź może dotyczyć kilku pytań: zaznacz, których.
      </p>
      <ol className="job-requirements-ref">
        {requirements.map((r, i) => (
          <li key={r.id} data-covered={!uncovered.includes(r) || undefined}>
            <span className="requirement-number">{i + 1}</span> {r.text}
          </li>
        ))}
      </ol>
      <ol className="requirements-list">
        {value.map((a, index) => {
          const state = gaps[a.id];
          const short = attempted && a.text.trim().length < MIN_APPLICATION_ANSWER_LENGTH;
          const untagged = attempted && a.text.trim() && a.requirementIds.length === 0;
          return (
            <li key={a.id} className="requirement-row">
              <div className="requirement-head">
                <span className="requirement-number">{index + 1}</span>
                <span className="record-caption">Odpowiedź {index + 1}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Usuń odpowiedź ${index + 1}`}
                  disabled={disabled || value.length === 1}
                  onClick={() => onChange(value.filter((x) => x.id !== a.id))}
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
              <Textarea
                aria-label={`Odpowiedź ${index + 1}`}
                aria-invalid={short || undefined}
                rows={4}
                maxLength={12000}
                disabled={disabled}
                value={a.text}
                placeholder="Projekt i okres, co zrobiłeś/aś sam/a, zakres i efekt."
                onChange={(e) => {
                  update(a.id, { text: e.target.value });
                  setGaps((g) => ({ ...g, [a.id]: undefined as never }));
                }}
              />
              {short && (
                <p className="error-message" role="alert">
                  Wpisz co najmniej {MIN_APPLICATION_ANSWER_LENGTH} znaków.
                </p>
              )}
              <fieldset className="answer-requirements" aria-invalid={untagged || undefined}>
                <legend>Odpowiada na pytania</legend>
                {requirements.map((r, i) => (
                  <label key={r.id}>
                    <Checkbox
                      disabled={disabled}
                      checked={a.requirementIds.includes(r.id)}
                      aria-label={`Odpowiedź ${index + 1} odpowiada na pytanie ${i + 1}`}
                      onCheckedChange={(checked) =>
                        update(a.id, {
                          requirementIds: checked
                            ? [...a.requirementIds, r.id]
                            : a.requirementIds.filter((x) => x !== r.id),
                        })
                      }
                    />
                    <span>
                      {i + 1}. {r.text}
                    </span>
                  </label>
                ))}
              </fieldset>
              {untagged && (
                <p className="error-message" role="alert">
                  Zaznacz, na które pytania odpowiada ten przykład.
                </p>
              )}
              <div className="record-actions">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    disabled ||
                    state === "busy" ||
                    a.text.trim().length < MIN_APPLICATION_ANSWER_LENGTH ||
                    a.requirementIds.length === 0
                  }
                  onClick={() => check(a)}
                >
                  <Sparkles aria-hidden="true" />{" "}
                  {state === "busy" ? "Asystent sprawdza…" : "Czego brakuje?"}
                </Button>
              </div>
              {state && state !== "busy" && (
                <div className="requirement-assessment" role="status">
                  {state === "offline" ? (
                    <p>Asystent wyłączony. Włącz go, żeby sprawdzić odpowiedź.</p>
                  ) : (
                    <>
                      <p>{state.note}</p>
                      {state.gaps.length > 0 && (
                        <ul>
                          {state.gaps.map((g) => (
                            <li key={g}>{g}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <div className="record-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || value.length >= 10}
          onClick={() => onChange([...value, newAnswer(uncovered.map((r) => r.id))])}
        >
          <Plus aria-hidden="true" /> Dodaj odpowiedź
        </Button>
      </div>
      <p
        role={attempted && uncovered.length ? "alert" : "status"}
        className={attempted && uncovered.length ? "error-message" : "record-caption"}
      >
        {uncovered.length
          ? `Bez odpowiedzi: pytania ${uncovered.map((r) => requirements.indexOf(r) + 1).join(", ")} z ${requirements.length}.`
          : `Każde z ${requirements.length} pytań ma odpowiedź.`}
      </p>
      <AssistantStatus />
    </section>
  );
}
