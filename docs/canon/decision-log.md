# Decision Log

Evidence basis: Kamiya@69adfd2; Cerbanimo@render-deploy ce5eca1.

## ADR-001

Date: 2026-07-02

Decision: Cerbanimo is the platform of record.

Status: accepted

Rationale: Cerbanimo owns identity, projects, tasks, rewards, communities, durable action records, workers, memory, and notifications.

Consequences: Kamiya must not duplicate Cerbanimo business logic or become a second database of record.

Repository evidence: Cerbanimo@render-deploy ce5eca1: `backend/server.js` route registration; `backend/routes/projects.js`; `backend/routes/tasks.js`; `models/kamiya_api.js`; `backend/services/ActionQueueService.js`.

Follow-up work: Move Kamiya project creation onto persisted Cerbanimo action APIs after the project-generation path is repaired.

## ADR-002

Date: 2026-07-02

Decision: Kamiya is a standalone conversational client and PMAA.

Status: accepted

Rationale: Kamiya has its own React chat surface, Express API, prompt orchestration, cards, and Cerbanimo API client.

Consequences: Kamiya can deploy independently but must consume documented Cerbanimo APIs.

Repository evidence: Kamiya@69adfd2: [README.md](../../README.md); [server/index.ts](../../server/index.ts); [src/App.tsx](../../src/App.tsx); [render.yaml](../../render.yaml).

Follow-up work: Stabilize API v1 contracts and SDK boundaries.

## ADR-003

Date: 2026-07-02

Decision: Mutations use preview and confirmation.

Status: accepted

Rationale: This preserves user agency and creates a natural path to durable audit records.

Consequences: Kamiya must preview project creation, task submission, and automation requests before execution. Destructive or high-risk actions require explicit user confirmation.

Repository evidence: Kamiya@69adfd2: [server/services/actionPlanner.ts](../../server/services/actionPlanner.ts) :: `previewProjectCreation()`, `previewAutomation()`, `previewTaskSubmission()`; Cerbanimo@render-deploy ce5eca1: `backend/services/ActionQueueService.js` :: `createPreview()`, `confirmAction()`.

Follow-up work: Replace Kamiya's local previews with Cerbanimo durable action previews for state-changing flows.

## ADR-004

Date: 2026-07-02

Decision: New durable orchestration should converge on PostgreSQL and pg-boss unless active behavior requires a temporary exception.

Status: accepted

Rationale: Cerbanimo already starts pg-boss, creates queues, schedules jobs, and uses Postgres tables for actions, automation runs, logs, and workflow tracking.

Consequences: BullMQ/ioredis and node-cron should be treated as deprecation candidates unless a future packet documents an active need.

Repository evidence: Cerbanimo@render-deploy ce5eca1: `backend/jobs/boss.js`; `backend/jobs/startWorkers.js`; `backend/jobs/workers/automationWorker.js`; `backend/services/EventBusService.js`; `package.json` includes `bullmq`, `ioredis`, and `node-cron` without active imports.

Follow-up work: Orchestration cleanup after action queue and worker deployment are stable.

## ADR-005

Date: 2026-07-02

Decision: The first real worker is `run_quality_checks`.

Status: accepted

Rationale: It is bounded, auditable, useful after project/task creation, and already has a partial Cerbanimo implementation.

Consequences: Broader GitHub/PR/deployment automation should wait until quality checks has idempotency, logs, retry behavior, and UI narration.

Repository evidence: Cerbanimo@render-deploy ce5eca1: `backend/services/CapabilityRegistryService.js` :: `automationTemplates`; `backend/services/AutomationWorkerService.js` :: `runQualityChecks()`; `backend/services/AutomationWorkerService.test.js`.

Follow-up work: Implement repository-target support, idempotency, and user-facing result cards.

## ADR-006

Date: 2026-07-02

Decision: Canon lives in `Kamiya/docs`.

Status: accepted

Rationale: Kamiya is the PMAA client being actively defined, and the canon must guide future implementation packets from one stable location.

Consequences: Documentation changes in this packet are limited to `Kamiya/docs/canon/`; Cerbanimo is reference-only.

Repository evidence: Product-owner packet; this branch adds [docs/canon](./).

Follow-up work: Keep canon updates paired with architecture-changing packets.

## ADR-007

Date: 2026-07-02

Decision: `render-deploy` is the Cerbanimo integration source of truth for now.

Status: accepted

Rationale: The packet explicitly identifies `glaedn/Cerbanimo` branch `render-deploy` as the reference repository.

Consequences: Evidence and next packets should cite that branch until the product owner changes the integration base.

Repository evidence: Product-owner packet; local Cerbanimo checkout is on `render-deploy`.

Follow-up work: Reconfirm branch before any implementation packet that changes Cerbanimo.

## ADR-008

Date: 2026-07-02

Decision: No production merge or deployment without explicit product-owner approval.

Status: accepted

Rationale: The packet requires a draft PR only and no merge.

Consequences: This packet must stop at a draft PR.

Repository evidence: Product-owner packet; no runtime files changed in this branch.

Follow-up work: Product owner decides when to merge or deploy.

## ADR-009

Date: 2026-07-02

Decision: Cerbanimo currently exposes two overlapping client API surfaces: `/platform` and `/api/v1`.

Status: investigate

Rationale: Both surfaces include permissions, AI routing/planning, actions, automation templates, validation reports, search, stats, and render/memory concepts.

Consequences: Client guidance can drift unless one surface becomes canonical or the split is documented.

Repository evidence: Cerbanimo@render-deploy ce5eca1: `backend/routes/platform.js`; `backend/routes/api_v1/index.js`; `backend/server.js` route registration.

Follow-up work: API v1 foundation packet should decide whether `/platform` is deprecated, internal, or a compatibility shim.

## ADR-010

Date: 2026-07-02

Decision: Cerbanimo Auth0 bridge is implemented enough for local Kamiya login, but remains provisional.

Status: provisional

Rationale: Bridge pages and Kamiya client handling exist, but previous callback URL and allowed-origin failures show the deployment contract is fragile.

Consequences: Auth bridge settings must be treated as launch-critical configuration, not incidental frontend code.

Repository evidence: Kamiya@69adfd2: [src/lib/authBridge.ts](../../src/lib/authBridge.ts); Cerbanimo@render-deploy ce5eca1: `src/pages/AuthBridge.jsx`, `src/App.jsx` routes `/auth/bridge/start` and `/auth/bridge/callback`.

Follow-up work: Auth0 popup bridge and permission introspection packet.

## ADR-011

Date: 2026-07-02

Decision: Kamiya Golden Conversation v1 uses Cerbanimo `/api/v1/actions` and `projects.bootstrap` as the only project-creation path.

Status: accepted

Rationale: The durable action/workflow API preserves preview, explicit consent, retry/cancel state, refresh recovery, audit events, and active-task delivery without splitting project creation and task generation across legacy routes.

Consequences: Kamiya may cache safe action identifiers in session state, but Cerbanimo action detail is authoritative. The legacy direct `/projects/create` plus `/projects/auto-generate` path is deprecated for project creation from Kamiya.

Repository evidence: Kamiya current branch: [server/services/cerbanimoClient.ts](../../server/services/cerbanimoClient.ts), [server/services/chatService.ts](../../server/services/chatService.ts), [e2e/golden-conversation.contract.spec.ts](../../e2e/golden-conversation.contract.spec.ts); Cerbanimo PR #145 `091f7ee`.

Follow-up work: Enable real-stack e2e with isolated Cerbanimo database and deterministic bootstrap generator, then implement task automation classification.

## ADR-012

Date: 2026-07-03

Decision: Task automation classification is durable eligibility metadata, not execution permission.

Status: accepted

Rationale: Users need truthful active-task semantics, but a model-generated or normalized classification must never grant capability availability, actor authorization, confirmation, execution, or validation.

Consequences: Cerbanimo stores and normalizes task classification before persistence. Kamiya renders `human_driven`, `assisted_automation`, and `fully_automatable` categories, but does not show an enabled Automate control until a later packet implements capability resolution, authorization, action preview, worker execution, and validation.

Repository evidence: Cerbanimo Packet 004 branch: `backend/services/TaskAutomationClassificationService.js`, `models/tasks.js`, `backend/services/ProjectBootstrapService.js`, `backend/routes/api_v1/index.js`; Kamiya Packet 004 branch: [server/services/cardFactory.ts](../../server/services/cardFactory.ts), [server/services/cerbanimoClient.ts](../../server/services/cerbanimoClient.ts), [docs/task-automation-classification.md](../task-automation-classification.md).

Follow-up work: Packet 005 Assisted Automation Input Contracts and Preparation Flow.
