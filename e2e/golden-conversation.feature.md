# Golden Conversation Feature Contract

This contract keeps Kamiya's long conversation as one product journey instead of separate demos.

## Stage 1: Quest Creation Through Active Tasks

Status: implemented for the deterministic browser contract and isolated real-stack browser acceptance.

Covered by `golden-conversation.contract.spec.ts`, `golden-conversation.integration.spec.ts`, and `golden-conversation.failure.spec.ts`:

- logged-in opening asks "What is your quest?";
- the golden natural-language quest is classified as planning;
- Kamiya derives title, description, outcome, tags, and a strict six-month due date;
- Cerbanimo persists a `projects.bootstrap` action preview;
- no confirmation occurs before the visible Confirm control is activated;
- confirmation queues the durable workflow;
- progress renders the seven bootstrap stages from Cerbanimo action detail;
- refresh rehydrates the same action identifier;
- terminal success renders the created project and active root tasks;
- Open Project and Explore Active Tasks controls are present;
- token-like values stay out of localStorage, DOM text, and URL;
- axe reports no critical or serious violations in deterministic and real-stack checkpoints;
- the real-stack profile uses real Kamiya React and Express, real Cerbanimo `/api/v1`, isolated PostgreSQL, and real pg-boss workers;
- failure coverage includes retry-on-timeout, invalid graph block, cancel-before-persist, network interruption, duplicate confirmation, missing auth, and cross-user hydration denial.

## Stage 2: Active Task Classification

Status: implemented for classification display and read-only assisted input summaries.

Covered by `golden-conversation.contract.spec.ts`, `golden-conversation.integration.spec.ts`, and the real-stack database verifier:

- Cerbanimo stores durable task automation metadata on each generated task;
- active tasks hydrate through `GET /api/v1/actions/:id` with canonical `automation` metadata;
- Kamiya renders `Human task`, `Automation-assisted`, and `Automation-ready classification`;
- assisted tasks expose a read-only required-input summary;
- fully automatable tasks expose capability, artifact, and validation requirements;
- no enabled `Automate` control is rendered;
- refresh preserves the classification display;
- DB verification asserts the deterministic 1/1/1 category mix and invariants.

Not implemented in Stage 2: assisted input submission, task automation execution, artifact validation, rewards, or task acceptance.

## Packet 003A Skipped-Test Inventory

| Test | Previous skip reason | Required dependency | Resolution |
| --- | --- | --- | --- |
| Real-stack golden conversation | No isolated Cerbanimo e2e stack. | Local Postgres, Cerbanimo `/api/v1`, pg-boss worker, deterministic provider seam. | Implemented in `golden-conversation.integration.spec.ts`; no v1 skip remains. |
| Retry once then success | Retry behavior needed real worker and provider control. | `timeout_once_then_success` deterministic scenario plus DB verifier. | Implemented in `golden-conversation.failure.spec.ts`. |
| Invalid graph blocked | Needed real graph validation before persistence. | `invalid_cycle` deterministic scenario and blocked workflow state. | Implemented in `golden-conversation.failure.spec.ts`. |
| Cancel before persistence | Needed a controllable pre-persist barrier. | `hold_before_persist` deterministic scenario and cancel endpoint. | Implemented in `golden-conversation.failure.spec.ts`. |
| Network interruption | Needed browser polling against real hydration endpoint. | Playwright route abort and recovery against Kamiya `/api/actions/hydrate`. | Implemented in `golden-conversation.failure.spec.ts`. |
| Double confirmation | Needed durable confirm idempotency proof. | Real `/api/v1/actions/:id/confirm` plus request log and DB verifier. | Implemented in `golden-conversation.failure.spec.ts`. |
| Authentication failure | Needed no-mock logged-out/expired browser state. | Missing/expired E2E session and DB no-action verifier. | Implemented in `golden-conversation.failure.spec.ts`. |
| Refresh recovery | Needed stable action IDs and session hydration. | Real-stack integration refresh during held running stage. | Implemented in `golden-conversation.integration.spec.ts`. |

Future-stage placeholders for automation execution, proof validation, rewards, dependency completion, and follow-on quests remain outside Golden Conversation v1.

## Stage 3: Task Automation Preparation And Quality Checks

Status: implemented for schema-driven preparation display, capability truthfulness, durable action preview, confirmed deterministic quality-check execution, refresh recovery, failure states, and database invariant checks.

Covered by `golden-conversation.contract.spec.ts`, `golden-conversation.integration.spec.ts`, and `golden-conversation.failure.spec.ts`:

- assisted task cards expose `Prepare with Kamiya`;
- quality-check tasks expose `Review quality checks`;
- Cerbanimo preparation metadata and capability resolution hydrate through `/api/v1/tasks/:taskId/automation`;
- unavailable assisted execution displays blocker reasons instead of fake controls;
- `github.run_quality_checks` creates a `tasks.run_automation` preview and requires confirmation;
- deterministic E2E execution creates one action, one automation run, one consumed preparation, logs, report, and one task submission;
- passing checks submit the task for review but do not award rewards or mark completion;
- queued/running quality-check runs recover from Cerbanimo state rather than relying on client state.

Not implemented in Stage 3: production sandbox execution, arbitrary GitHub write actions, PR creation, deployment, proof validation by AI, rewards, or project completion recursion.

## Stage 4: Review And Scoring

Status: not implemented.

Required platform/API dependencies:

- validation reports tied to task submissions;
- scoring/rubric APIs;
- review state transitions exposed through `/api/v1`.

## Stage 5: Assisted Input Form

Status: not implemented.

Required platform/API dependencies:

- task-specific input schema descriptors;
- draft save and submit endpoints;
- file/proof attachment policy.

## Stage 6: Human Task Acceptance

Status: not implemented.

Required platform/API dependencies:

- claim/accept action function;
- task assignment state detail;
- conflict handling when another user claims first.

## Stage 7: Game Master Narrative Guidance

Status: implemented for preference controls, quest context cards, party assembly cards, calling cards, chronicle cards, and launch previews.

Covered by unit/contract tests and targeted browser acceptance:

- `/game-master`, `/narrative`, `/stats`, `/quest`, `/party`, `/calling`, `/launch quest`, and `/chronicle` commands;
- one-turn plain override that starts with `Out of character:`;
- Cerbanimo `/api/v1` quest context as the authoritative fact pack;
- no reward, completion, dependency activation, or story publication claims;
- one-time invite secrets redacted before saved chat persistence.

See `docs/game-master-mode.md`.

## Stage 8: Reflection And Proof Submission

Status: not implemented.

Required platform/API dependencies:

- proof schema;
- submission action preview/confirm;
- file upload or external proof-link validation.

## Stage 9: Validation

Status: not implemented.

Required platform/API dependencies:

- validation action function;
- reviewer/agent status;
- stable retry and appeal states.

## Stage 10: XP And Token Reporting

Status: not implemented.

Required platform/API dependencies:

- application-calculated reward events;
- token ledger read API;
- XP/level deltas in task completion detail.

## Stage 11: Dependency Activation

Status: not implemented in Kamiya beyond displaying active root tasks returned by project bootstrap.

Required platform/API dependencies:

- task dependency activation events;
- project activity feed or notification stream;
- action detail hydration after downstream task completion.

## Stage 12: Project Completion

Status: not implemented.

Required platform/API dependencies:

- project completion criteria;
- terminal project status event;
- completion summary card data.

## Stage 13: Follow-On Quest Proposal

Status: not implemented.

Required platform/API dependencies:

- completed project context summaries;
- recommendation endpoint or planner mode prompt contract;
- explicit preview/confirm flow for follow-on project creation.
