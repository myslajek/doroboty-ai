# Requirements, pinned answers and coverage (prototype idea-1)

## Intent

Stop Match Score inflation after writing assistants by changing what enters the portal: employers state 3–5 concrete requirements, candidates pin examples of their own work to them, recruiters judge coverage per requirement with an assistant proposal. Decision and definition: second brain `3-Projects/do-roboty-ai/supersprint/tydzien-3/01-definicja-prototypu.md`.

## Acceptance criteria

- New job: 3–5 requirements required; assistant verdict concrete/generic with suggestion; generic blocks publication; offline assistant does not block (label "Nieocenione"). Old jobs unchanged.
- Application to a job with requirements: answers tagged to requirements, every requirement covered, assistant lists gaps; draft keeps answers.
- Recruiter: per-requirement assistant percent + note + gaps, recruiter verdict overrides sorting; batch assessment on the list.
- Version-1 state stays compatible; new fields optional.

## Implementation and verification

- Model: `requirementSchema`, `answerSchema`, `coverageSchema`, actions `coverage` and `verdict`, publication gate in `transition`; `coverageSummary` for sorting. Fixture `data/fixture-pub-003947.json` generated from the course CSVs (pub-003947, June 2026).
- UI: `requirements-editor.tsx`, `answers-editor.tsx`, `coverage-panel.tsx`, `jobs/job-requirements.tsx`; wired into `employer.tsx`, `workspace.tsx` (ApplyPage, ApplicationsPage), `application-record.tsx`, `recruiting-application.tsx`, `candidate-application.tsx`. Styles appended to `src/app/workspace.css`.
- Assistant: `assistant/watch.mjs`, `assistant/vite-plugin.mjs`, `assistant/prompts/*.md`, client `src/features/prototype/assistant/client.ts`.
- Checks run 2026-11-06: prettier, design-system:check, lint, tsc, 37 unit tests (10 new in `requirements.test.ts`), verify:packet, vite build: all pass. Playwright e2e not run: Playwright Chromium is not provisioned on this machine; manual browser journeys were driven with Playwright on Microsoft Edge (screenshots in the second brain, `prototypes/2026-11-06-idea-1-ekrany/`).
- Batch assessment of the 20 fixture applications (sonnet, ~0.08 USD and 7–9 s each): 1 of 20 averages ≥75% coverage; 12 templated applications score 2–6%; a demo-only answer scores 0–5%; the strongest hand-written answer 70–93% per requirement.

## Limits

The 20-application sample was selected and 8 answers were written by the author, so the distribution checks the mechanism, not the market. Percentages vary between runs; the recruiter verdict is the record of decision.
