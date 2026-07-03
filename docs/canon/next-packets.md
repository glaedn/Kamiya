# Recommended Next Packets

Evidence basis: Kamiya branch `kamiya/m3-task-automation-classification`; Cerbanimo branch `kamiya/m2-task-automation-classification`. Golden Conversation v1 now reaches active task classification, but task execution and assisted-input submission remain intentionally unimplemented.

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

## Completed Baseline: Packet 004 Task Automation Classification

Status: complete for durable classification metadata and truthful Kamiya rendering.

Original goal: Classify active tasks as human-driven, assisted automation, or fully automatable using authoritative Cerbanimo task metadata and capability policy.

User-visible outcome: After Kamiya creates a project, active task cards clearly show whether Cami should do the task, inspect inputs for assisted automation, or understand that a task is classified for bounded automation once an execution capability is connected.

Repository scope: Cerbanimo task schema/metadata, task generation prompt validation, deterministic normalization, `/api/v1/tasks` and action detail payloads; Kamiya task cards and Golden Conversation continuation tests.

Primary risk addressed: Classification is durable platform metadata and normalized before persistence, not a client-side or AI-only inference.

Proof of completion: Generated and manual tasks expose classification metadata; deterministic provider includes one task in each category; Kamiya renders distinct labels and required-input summaries without fake Automate controls; browser and DB verification assert the category mix.

## Packet 005: Assisted Automation Input Contracts And Preparation Flow

Goal: Turn `required_human_inputs` into a secure, schema-driven preparation flow that collects inputs and produces a reviewable automation action preview without executing arbitrary work.

User-visible outcome: For an assisted task, Cami can open the required-input summary, supply repository/branch/approval/context fields, and receive a safe preview of what Kamiya could prepare next.

Repository scope: Cerbanimo task input schema validation, action preview payloads for prepared automation, optional draft storage, and capability/authorization introspection; Kamiya read/write assisted-input form and preview cards.

Dependencies: Packet 004 task automation metadata and existing `/api/v1/actions` preview/confirm contract.

Primary risk: Treating user-supplied inputs as immediate permission to execute. Packet 005 should stop at a reviewable preview.

Estimated size: L

Proof of completion: Assisted task inputs validate against Cerbanimo-provided schemas, sensitive values are represented only as secret references, previews are durable action records, no worker executes, and browser tests cover desktop/mobile form behavior.

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
