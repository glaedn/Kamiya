# Recommended Next Packets

Evidence basis: Kamiya branch `kamiya/m2-golden-conversation-v1`; Cerbanimo branch `kamiya/m1-durable-project-bootstrap`. Golden Conversation v1 real-stack acceptance is now complete, so the next packet should move forward into task automation classification instead of more bootstrap proof.

## Completed Baseline: Packet 002 Project Creation Bootstrap

Status: complete for Golden Conversation v1 through the durable `projects.bootstrap` action path.

Original goal: Make the golden path from Kamiya project confirmation to Cerbanimo active tasks reliable, observable, and test-covered.

User-visible outcome: Cami creates a project and sees active tasks or a clear, retryable, non-duplicating error with traceable logs.

Repository scope: Cerbanimo `backend/routes/projects.js`, `backend/services/taskGenerator.js`, `backend/services/TaskRoutingService.js`, route tests; Kamiya `server/services/cerbanimoClient.ts` only if contract changes are needed.

Dependencies: Cerbanimo `/api/v1/actions` and the `projects.bootstrap` worker path.

Primary risk: LLM-generated task graph can be malformed while still passing superficial JSON parsing.

Estimated size: M

Proof of completion: Real-stack tests cover project insert, generation success, invalid graph blocking, idempotent retry, active task hydration, and logged request IDs.

## Completed Baseline: Packet 003 API v1 Golden Path

Status: complete for the project-creation golden path.

Original goal: Choose and harden the canonical client API surface for Kamiya and future clients.

User-visible outcome: Kamiya receives predictable errors and can show actionable blockers instead of `[object Object]` or generic failures.

Repository scope: Cerbanimo `backend/routes/api_v1/index.js`, `backend/routes/platform.js`, `backend/utils/apiEnvelope.js`, OpenAPI doc; Kamiya `server/services/cerbanimoClient.ts` adapters.

Dependencies: Packet 002 findings.

Primary risk: Legacy route compatibility.

Estimated size: L

Proof of completion: Kamiya calls `/api/v1/actions/preview`, `/confirm`, and action hydration for `projects.bootstrap`; request IDs appear in responses; legacy `/platform`, `/projects/create`, and `/projects/auto-generate` calls are blocked by browser tests for the golden path.

## Packet 004: Task Automation Classification

Goal: Classify active tasks as human-driven, assisted automation, or fully automatable using authoritative Cerbanimo task metadata and capability policy.

User-visible outcome: After Kamiya creates a project, active task cards clearly show whether Cami should do the task, supply inputs for Kamiya to help, or allow Kamiya to queue an automation after confirmation.

Repository scope: Cerbanimo task schema/metadata, task generation prompt validation, capability registry, `/api/v1/tasks` or action detail payloads; Kamiya task cards and Golden Conversation continuation tests.

Dependencies: Golden Conversation v1 bootstrap contract and task graph persistence.

Primary risk: Classification becomes AI-only and non-auditable instead of platform-owned metadata.

Estimated size: M

Proof of completion: Generated and manual tasks expose classification plus required human-input metadata; Kamiya renders distinct actions without fake controls; the golden conversation continues from project creation into the first active-task choice.

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

## Packet 007: Auth0 Permission Introspection And Settings

Goal: Formalize the permission contract between Kamiya and Cerbanimo beyond the working popup bridge.

User-visible outcome: Kamiya explains unavailable actions by permission and shows connection health in settings.

Repository scope: Cerbanimo `/api/v1/auth/permissions` or equivalent; Kamiya auth settings UI.

Dependencies: API foundation.

Primary risk: Auth0 dashboard settings remain outside repo and can drift.

Estimated size: M

Proof of completion: Permission introspection is shown in Kamiya settings and tested locally.

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
