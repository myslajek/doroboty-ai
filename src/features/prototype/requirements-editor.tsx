import { useState } from "react";
import { Lightbulb, Plus, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestAssistant } from "./assistant/client";
import { AssistantStatus } from "./assistant/status";
import { MAX_REQUIREMENTS, MIN_REQUIREMENTS, type Requirement } from "./model";

const kindLabels: Record<string, string> = {
  wklad: "Własny wkład",
  rezultat: "Rezultat",
  utrzymanie: "Utrzymanie",
  uzgodnienia: "Uzgodnienia",
  dane: "Dane",
  inne: "Inne",
};
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
    setMessage("Asystent ocenia pytania…");
    const result = await assessRequirements(value, context);
    setBusy(false);
    if (result.status === "done") {
      onChange(result.requirements);
      const generic = result.requirements.filter((r) => r.assessment?.verdict === "generic").length;
      setMessage(
        generic
          ? `Asystent ocenił: ${generic} z ${filled} to ogólnik. Popraw lub użyj propozycji.`
          : "Asystent ocenił: wszystkie pytania są konkretne.",
      );
    } else if (result.status === "offline")
      setMessage("Asystent wyłączony. Pytania zostaną ocenione po uruchomieniu npm run assistant.");
    else
      setMessage(result.outcome?.status === "error" ? result.outcome.message : "Błąd asystenta.");
  }
  const canPropose = context.brief.trim().length >= 20;
  const [proposals, setProposals] = useState<{ text: string; why: string; kind: string }[]>([]);
  const [tips, setTips] = useState<string[]>([]);
  async function propose() {
    setBusy(true);
    setMessage("Asystent proponuje pytania z briefu…");
    const outcome = await requestAssistant("propose", {
      title: context.title,
      brief: context.brief.trim(),
    });
    setBusy(false);
    if (outcome.status === "done") {
      setProposals(outcome.result.items);
      setTips(outcome.result.tips);
      setMessage(
        `Asystent zaproponował ${outcome.result.items.length} pytania. Dodaj te, które pasują do tej roli, i zmień je swobodnie.`,
      );
    } else if (outcome.status === "offline")
      setMessage("Asystent wyłączony. Uruchom npm run assistant, żeby dostać propozycje.");
    else setMessage(outcome.message);
  }
  function addProposal(item: { text: string; why: string }) {
    if (value.filter((r) => r.text.trim()).length >= MAX_REQUIREMENTS) return;
    const empty = value.find((r) => !r.text.trim());
    const next = {
      ...(empty ?? newRequirement()),
      text: item.text,
      assessment: { verdict: "concrete" as const, note: item.why || "Propozycja asystenta." },
    };
    onChange(empty ? value.map((r) => (r.id === empty.id ? next : r)) : [...value, next]);
    setProposals((list) => list.filter((x) => x.text !== item.text));
  }
  return (
    <section className="requirements-editor" aria-labelledby="requirements-title">
      <h2 id="requirements-title">
        Pytania do kandydata{" "}
        {optional
          ? "(opcjonalne dla starszych ofert)"
          : `(${MIN_REQUIREMENTS}–${MAX_REQUIREMENTS})`}
      </h2>
      <p className="application-help">
        Zapytaj o zadanie z przeszłości podobne do tego, które czeka w tej roli. Kandydat odpowie
        przykładem z własnej pracy: projekt, okres, co zrobił sam, efekt. Pytaj o rodzaj zadania i
        zakres odpowiedzialności, nie o branżę i nie o cechy.
      </p>
      <aside className="prototype-notice requirements-tips" aria-labelledby="tips-title">
        <strong id="tips-title">O co warto zapytać</strong>
        <ul>
          <li>Własny wkład: „co należało do Ciebie, a co do innych” w podobnym zadaniu.</li>
          <li>Rezultat: jak sprawdzono, że to działa (próbka, miara, co zmieniono po wyniku).</li>
          <li>Utrzymanie albo uzgodnienia: co po wdrożeniu, z kim trzeba było to ustalać.</li>
          {tips.map((tip) => (
            <li key={tip}>
              <em>Z Twojego briefu:</em> {tip}
            </li>
          ))}
        </ul>
        <p className="record-caption">
          Rekruterzy najczęściej dopisują po screeningu uzgodnienia między działami i utrzymanie.
          Dopisane po screeningu obniża kontynuacje 2–3×, więc lepiej zapytać od razu.
        </p>
      </aside>
      <div className="record-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy || !canPropose}
          title={canPropose ? undefined : "Najpierw wpisz brief (min. 20 znaków)."}
          onClick={propose}
        >
          <Lightbulb aria-hidden="true" /> Zaproponuj pytania z briefu
        </Button>
      </div>
      {proposals.length > 0 && (
        <section className="requirements-proposals" aria-labelledby="proposals-title">
          <h3 id="proposals-title">Propozycje asystenta</h3>
          <ul>
            {proposals.map((item) => (
              <li key={item.text}>
                <div>
                  <p>{item.text}</p>
                  <p className="record-caption">
                    {kindLabels[item.kind] ?? "Inne"} · {item.why}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || value.filter((r) => r.text.trim()).length >= MAX_REQUIREMENTS}
                  onClick={() => addProposal(item)}
                >
                  <Plus aria-hidden="true" /> Dodaj
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
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
                aria-label={`Usuń pytanie ${index + 1}`}
                disabled={busy}
                onClick={() => onChange(value.filter((x) => x.id !== r.id))}
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <Textarea
              aria-label={`Pytanie ${index + 1}`}
              rows={2}
              maxLength={400}
              disabled={busy}
              value={r.text}
              placeholder="Np. Opowiedz o projekcie, w którym sam/a zbudowałeś/aś komponent przetwarzający teksty. Co należało do Ciebie, a co do innych?"
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
          <Plus aria-hidden="true" /> Dodaj własne pytanie
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
        {message || `${filled} z ${MAX_REQUIREMENTS} pytań.`}
      </p>
      <AssistantStatus />
    </section>
  );
}
