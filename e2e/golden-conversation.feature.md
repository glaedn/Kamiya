# Golden Conversation Feature Contract

This contract keeps Kamiya's long conversation as one product journey instead of separate demos.

## Stage 1: Quest Creation Through Active Tasks

Status: implemented for the deterministic browser contract.

Covered by `golden-conversation.contract.spec.ts`:

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
- axe reports no critical or serious violations in the deterministic run.

## Stage 2: Active Task Classification

Status: not implemented.

Required platform/API dependencies:

- task automation eligibility metadata on Cerbanimo tasks;
- an endpoint that classifies tasks as human-driven, assisted automation, or fully automatable;
- a documented action function for queuing automation against a specific task.

Playwright placeholder: `golden-conversation.failure.spec.ts`.

## Stage 3: Automated Task Execution

Status: not implemented.

Required platform/API dependencies:

- auditable automation action objects;
- worker status and logs;
- safe artifact return contracts;
- permission checks per automation template.

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

## Stage 7: Narrative Guidance

Status: not implemented.

Required platform/API dependencies:

- safe project/task context summaries;
- user preference memory;
- guidance cards that do not mutate platform state.

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
