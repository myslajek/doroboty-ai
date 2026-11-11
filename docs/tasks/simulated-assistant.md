# Simulated assistant for the published build

## Intent

The local assistant (REQ-04) exists only behind the dev-server bridge, so in a static deployment every assistant button would fail and the main journey (employer questions → candidate answers → recruiter list with coverage and summary) would not work. The published version replays recorded model answers instead and says so.

## Acceptance criteria

- Static build makes no `/__assistant/*` request; `npm run dev` keeps the live watcher bridge. `VITE_ASSISTANT_MODE=live|simulated` overrides the default.
- The 20 fixture applications get the recorded model answer for the current questions (exact text match).
- Any other text gets the closest recorded example and the UI states that it is an example, not an assessment of that text.
- The status line names the demonstration mode. No secret, key or model call in the browser.

## Implementation and verification

- `assistant/simulated.ts` (matching, id remapping), `assistant/client.ts` (mode switch, lazy-loaded `recordings.json`), `assistant/status.tsx`, example notice in `requirements-editor.tsx`, `answers-editor.tsx`, `coverage-panel.tsx`.
- `scripts/build-assistant-recordings.mjs` + `npm run assistant:record` rebuild `recordings.json` from `assistant/exchange/`.
- Unit tests: `assistant/simulated.test.ts`. Results of the gate run are reported in the change summary.

## Limits

Recorded answers are from sonnet runs between 2026-11-06 and 2026-11-11 and include answers to the earlier "requirements" wording. An example shown for new text can contradict that text; only the label protects the reader. Re-record after changing the fixture job questions or prompts.
