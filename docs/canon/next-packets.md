# Recommended Next Packets

Evidence basis: Kamiya@69adfd2; Cerbanimo@render-deploy ce5eca1. The order keeps the packet owner's requested first items, with one dependency-aware adjustment: API v1 foundation remains immediately after project-generation repair because most later work depends on stable envelopes, request IDs, scopes, and OpenAPI.

## Packet 002: Repair And Instrument Project Creation To Task Generation

Goal: Make the golden path from Kamiya project confirmation to Cerbanimo active tasks reliable, observable, and test-covered.

User-visible outcome: Cami creates a project and sees active tasks or a clear, retryable, non-duplicating error with traceable logs.

Repository scope: Cerbanimo `backend/routes/projects.js`, `backend/services/taskGenerator.js`, `backend/services/TaskRoutingService.js`, route tests; Kamiya `server/services/cerbanimoClient.ts` only if contract changes are needed.

Dependencies: Current `/projects/create`, `/projects/auto-generate`, `/projects/:id/task-status`.

Primary risk: LLM-generated task graph can be malformed while still passing superficial JSON parsing.

Estimated size: M

Proof of completion: Integration tests cover project insert, generation success, no-task failure, malformed dependencies, idempotent retry, active task polling, and logged request IDs.

## Packet 003: API v1 Foundation, Response Envelopes, Request IDs, And OpenAPI Scaffold

Goal: Choose and harden the canonical client API surface for Kamiya and future clients.

User-visible outcome: Kamiya receives predictable errors and can show actionable blockers instead of `[object Object]` or generic failures.

Repository scope: Cerbanimo `backend/routes/api_v1/index.js`, `backend/routes/platform.js`, `backend/utils/apiEnvelope.js`, OpenAPI doc; Kamiya `server/services/cerbanimoClient.ts` adapters.

Dependencies: Packet 002 findings.

Primary risk: Legacy route compatibility.

Estimated size: L

Proof of completion: OpenAPI includes golden-path projects/tasks/actions/chats; request IDs appear in logs and responses; Kamiya parses normalized envelopes.

## Packet 004: Auth0 Popup Bridge And Permission Introspection

Goal: Formalize the login/token/permission contract between Kamiya and Cerbanimo.

User-visible outcome: Login popup closes reliably, Kamiya shows logged-in state after refresh, and unavailable actions explain missing permission.

Repository scope: Cerbanimo `src/pages/AuthBridge.jsx`, `backend/services/apiAuthService.js`, `/auth/permissions` or `/api/v1/auth/permissions`; Kamiya [src/lib/authBridge.ts](../../src/lib/authBridge.ts), auth settings UI.

Dependencies: API foundation or a stable interim permission endpoint.

Primary risk: Auth0 dashboard settings are outside repo.

Estimated size: M

Proof of completion: Local and Render auth bridge checklist, callback tests where possible, permission introspection shown in Kamiya settings.

## Packet 004A: Real-Stack Golden Conversation Enablement And Task Automation Classification

Goal: Turn the Packet 003 deterministic browser contract into a real-stack browser test against Cerbanimo PR #145 or reviewed descendant, then add authoritative task automation classification.

User-visible outcome: Cami can create a project through Kamiya against real local Cerbanimo and see which active tasks are human-driven, assisted, or automatable without fake controls.

Repository scope: Cerbanimo deterministic bootstrap provider/test DB guard/database verifier; Kamiya `e2e/golden-conversation.integration.spec.ts`, task cards, docs.

Dependencies: Cerbanimo isolated e2e database/schema, deterministic `projects.bootstrap` generator mode, scoped e2e actor/token.

Primary risk: Accidentally running cleanup or mutation against development/production data.

Estimated size: L

Proof of completion: `KAMIYA_REAL_STACK_E2E=1 npm run test:e2e:integration` passes, database verifier proves one action/workflow/project/task graph, and task cards show only implemented authoritative actions.

## Packet 005: Persistent Action Queue And Audit Log

Goal: Make Cerbanimo `api_actions` the source of truth for every Kamiya mutation.

User-visible outcome: Every state-changing request has durable preview, confirmation, execution status, retry state, and history.

Repository scope: Cerbanimo `models/kamiya_api.js`, `backend/services/ActionQueueService.js`, `/api/v1/actions`; Kamiya action preview and confirmation flow.

Dependencies: API foundation and permission introspection.

Primary risk: Existing direct legacy mutations bypass the action queue.

Estimated size: L

Proof of completion: Kamiya project creation and automation use persisted action IDs; audit events exist for preview, confirm, execute, fail, retry, cancel.

## Packet 006: `run_quality_checks` Worker

Goal: Turn `run_quality_checks` into the first fully real bounded automation worker.

User-visible outcome: Cami can ask Kamiya to run quality checks and receive a clear pass/fail report with findings.

Repository scope: Cerbanimo `backend/services/AutomationWorkerService.js`, `backend/jobs/workers/automationWorker.js`, automation tests; Kamiya automation cards.

Dependencies: Persistent action queue.

Primary risk: Repository/CI targets require external credentials and sandbox policy.

Estimated size: M

Proof of completion: Worker is idempotent, logs steps, supports project target and one repository target mode, and returns renderable result cards.

## Packet 007: Task Automation-Classification Contract And UI Behavior

Goal: Classify tasks as human-driven, automatable with human input, or fully automatable.

User-visible outcome: Active tasks display the correct interaction pattern in Kamiya.

Repository scope: Cerbanimo task schema/metadata, capability registry, task generation prompt validation; Kamiya task cards.

Dependencies: Task-generation reliability and API foundation.

Primary risk: Classification logic could become AI-only and non-auditable.

Estimated size: M

Proof of completion: Generated and manual tasks expose classification plus required human-input metadata; Kamiya renders distinct actions.

## Packet 008: Submission-Validation Pipeline Foundation

Goal: Normalize proof submission, validation records, review state, challenge/appeal state, and approval effects.

User-visible outcome: Cami can see why work is accepted, rejected, pending validation, or blocked.

Repository scope: Cerbanimo `backend/controllers/taskController.js`, `backend/routes/verification_v2.js`, validation services, tests; Kamiya validation-report cards.

Dependencies: API foundation and action audit.

Primary risk: Prompt-injection from proof links/files.

Estimated size: L

Proof of completion: Proof links/files are sanitized or isolated, validation records are durable, and task reward release is traceable.

## Packet 009: Notification Policy And Kamiya/Cerbanimo Delivery

Goal: Define when Cerbanimo emits notifications and how Kamiya narrates them without becoming noisy.

User-visible outcome: Progress celebrations and blockers appear at useful moments.

Repository scope: Cerbanimo `NotificationService`, notification routes, Socket.io, Kamiya notification cards.

Dependencies: Task and action lifecycle stability.

Primary risk: Too much noise or duplicated delivery.

Estimated size: M

Proof of completion: Notification types, rate limits, delivery channels, and card mappings are documented and tested.

## Packet 010: GitHub Integration

Goal: Implement GitHub issue/PR/review workflows through durable Cerbanimo actions.

User-visible outcome: Kamiya can draft GitHub issues or review PRs after explicit confirmation.

Repository scope: Cerbanimo automation templates, credentials/config, worker implementations; Kamiya automation cards.

Dependencies: `run_quality_checks` worker and persistent actions.

Primary risk: Credential safety and repository permissions.

Estimated size: L

Proof of completion: GitHub actions block without config, run with test repo config, and log created issue/PR URLs.

## Packet 011: UI De-Sloppification Audit And Design-System Cleanup

Goal: Remove inconsistent AI-generated design patterns and consolidate high-quality interaction styles.

User-visible outcome: Kamiya and Cerbanimo feel coherent, polished, and task-oriented.

Repository scope: Kamiya frontend first; Cerbanimo high-traffic project/task/auth pages second.

Dependencies: Golden path stable enough to test visually.

Primary risk: Cosmetic churn hiding functional regressions.

Estimated size: M

Proof of completion: Screenshots across desktop/mobile, component checklist, no overlapping text, no nested card anti-patterns, no broken task/project pages.

## Later Packets

| Packet | Goal | Reason deferred |
| --- | --- | --- |
| Dedicated Render worker service | Move pg-boss workers out of the API process. | Best after worker behavior is stable. |
| Storage/upload repair | Harden Backblaze B2 and cleanup committed upload files. | Important but not on golden path unless profile/badge flows block launch. |
| Multi-platform chat parity | Discord/Google Chat parity for Kamiya. | Slack and voice are first-cycle exclusions; Discord should follow stable APIs. |
| Public SDK | Generate and publish stable client SDK. | Requires API v1/OpenAPI maturity. |
