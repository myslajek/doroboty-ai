import { useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestAssistant } from "./assistant/client";
import { AssistantStatus } from "./assistant/status";
import { MAX_REQUIREMENTS, MIN_REQUIREMENTS, type Requirement } from "./model";

export const verdictLabels = {
  concrete: "Konkretne",
  generic: "Ogólnik",
  pending: "Nieocenione",
} as const;
export function RequirementBadge({ requirement }: { requirement: Requirement }) {
  const verdict = requirement.assessment?.verdict ?? "pending";
  return (
    <Badge
      variant={
        verdict === "concrete" ? "default" : verdict === "generic" ? "destructive" : "secondary"
      }
      data-verdict={verdict}
    >
      {verdictLabels[verdict]}
    </Badge>
  );
}
export function newRequirement(text = ""): Requirement {
  return { id: `req-${crypto.randomUUID().slice(0, 8)}`, text };
}
/** Ocenia wymagania asystentem; zwraca listę z wynikiem albo `null`, gdy asystent nie odpowiedział. */
export async function assessRequirements(
  requirements: Requirement[],
  context: { title: string; brief: string },
) {
  const pending = requirements.filter((r) => r.text.trim() && !r.assessment);
  if (!pending.length) return { requirements, status: "done" as const };
  const outcome = await requestAssistant("requirements", {
    ...context,
    requirements: pending.map((r) => ({ id: r.id, text: r.text.trim() })),
  });
  if (outcome.status !== "done") return { requirements, status: outcome.status, outcome };
  const byId = new Map(outcome.result.items.map((item) => [item.id, item]));
  return {
    status: "done" as const,
    requirements: requirements.map((r) => {
      const item = byId.get(r.id);
      return item
        ? {
            ...r,
            assessment: {
              verdict: item.verdict,
              note: item.note,
              suggestion: item.suggestion?.trim() || undefined,
            },
          }
        : r;
    }),
  };
}
/**
 * Edytor 3–5 wymagań „co kandydat ma pokazać własnym przykładem”.
 * Asystent ocenia konkret/ogólnik i proponuje konkretniejszą wersję; nie pisze za pracodawcę.
 */
export function RequirementsEditor({
  value,
  onChange,
  context,
  optional = false,
}: {
  value: Requirement[];
  onChange: (next: Requirement[]) => void;
  context: { title: string; brief: string };
  optional?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const filled = value.filter((r) => r.text.trim()).length;
  function update(id: string, patch: Partial<Requirement>) {
    onChange(value.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  async function assess() {
    setBusy(true);
    setMessage("Asystent ocenia wymagania…");
    const result = await assessRequirements(value, context);
    setBusy(false);
    if (result.status === "done") {
      onChange(result.requirements);
      const generic = result.requirements.filter((r) => r.assessment?.verdict === "generic").length;
      setMessage(
        generic
          ? `Asystent ocenił: ${generic} z ${filled} to ogólnik. Popraw lub użyj propozycji.`
          : "Asystent ocenił: wszystkie wymagania są konkretne.",
      );
    } else if (result.status === "offline")
      setMessage(
        "Asystent wyłączony. Wymagania zostaną ocenione po uruchomieniu npm run assistant.",
      );
    else
      setMessage(result.outcome?.status === "error" ? result.outcome.message : "Błąd asystenta.");
  }
  return (
    <section className="requirements-editor" aria-labelledby="requirements-title">
      <h2 id="requirements-title">
        Wymagania{" "}
        {optional
          ? "(opcjonalne dla starszych ofert)"
          : `(${MIN_REQUIREMENTS}–${MAX_REQUIREMENTS})`}
      </h2>
      <p className="application-help">
        Napisz, co kandydat ma pokazać przykładem z własnej pracy: zadanie z pierwszego projektu,
        nie cechę. Kandydat do każdego wymagania dopisze swój projekt, okres i co zrobił sam.
      </p>
      <ol className="requirements-list">
        {value.map((r, index) => (
          <li
            key={r.id}
            className="requirement-row"
            data-verdict={r.assessment?.verdict ?? "pending"}
          >
            <div className="requirement-head">
              <span className="requirement-number">{index + 1}</span>
              <RequirementBadge requirement={r} />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Usuń wymaganie ${index + 1}`}
                disabled={busy}
                onClick={() => onChange(value.filter((x) => x.id !== r.id))}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <Textarea
              aria-label={`Wymaganie ${index + 1}`}
              rows={2}
              maxLength={400}
              disabled={busy}
              value={r.text}
              placeholder="Np. Zbudowałeś/aś klasyfikator zgłoszeń klientów i utrzymywałeś/aś go po wdrożeniu."
              onChange={(e) => update(r.id, { text: e.target.value, assessment: undefined })}
            />
            {r.assessment && (
              <div className="requirement-assessment">
                <p>{r.assessment.note}</p>
                {r.assessment.verdict === "generic" && r.assessment.suggestion && (
                  <div className="requirement-suggestion">
                    <p>
                      <strong>Propozycja:</strong> {r.assessment.suggestion}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        update(r.id, { text: r.assessment!.suggestion!, assessment: undefined })
                      }
                    >
                      Użyj propozycji
                    </Button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="record-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || value.length >= MAX_REQUIREMENTS}
          onClick={() => onChange([...value, newRequirement()])}
        >
          <Plus aria-hidden="true" /> Dodaj wymaganie
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !filled || !value.some((r) => r.text.trim() && !r.assessment)}
          onClick={assess}
        >
          <Sparkles aria-hidden="true" /> Oceń z asystentem
        </Button>
      </div>
      <p role="status" className="record-caption">
        {message || `${filled} z ${MAX_REQUIREMENTS} wymagań.`}
      </p>
      <AssistantStatus />
    </section>
  );
}
