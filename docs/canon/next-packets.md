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

## Completed Baseline: Packet 005 Assisted Automation Input Contracts And Preparation Flow

Status: complete for durable preparation records, server validation, capability truthfulness, and preview creation.

User-visible outcome: For an assisted task, Cami can open the required-input summary, see the required schema, save/validate preparation through Cerbanimo, and receive honest unavailable-capability reasons when no executor exists.

Repository scope completed: Cerbanimo task input schema validation, durable `task_automation_preparations`, action preview payloads for prepared automation, capability resolution, and Kamiya preparation cards.

Dependencies: Packet 004 task automation metadata and existing `/api/v1/actions` preview/confirm contract.

Primary risk addressed: User-supplied inputs are not immediate permission to execute; preview and confirmation remain mandatory.

Proof of completion: Preparation APIs validate and snapshot schemas, raw sensitive values are rejected, unavailable capabilities are shown truthfully, and browser tests cover preparation display/resume behavior.

## Completed Baseline: Packet 006 `run_quality_checks` Worker

Status: complete for deterministic E2E execution and task submission mapping.

User-visible outcome: Cami can review a quality-check action preview, confirm it, and receive a durable quality-check report. Passing checks submit the task for review.

Repository scope completed: Cerbanimo `AutomationWorkerService`, `automationWorker`, `TaskAutomationCapabilityResolver`, `TaskAutomationPreparationService`, validation tests, and Kamiya automation cards/client polling.

Dependencies: Persistent action queue.

Primary risk addressed: No arbitrary shell commands are accepted, and production execution fails closed without a sandbox.

Proof of completion: Real-stack integration verifies one action, one consumed preparation, one automation run, one report, and one submitted task; failure matrix covers retry, cancel, duplicate confirmation, auth failure, and cross-user denial.

## Packet 007: Production Sandbox And Automation Form UX

Goal: Add a production-safe quality-check executor and replace command-style preparation input with a full editable form/panel.

User-visible outcome: Cami can enter/edit repository, ref, profile, and approval fields through a polished form; production quality checks remain disabled until the sandbox provider is configured.

Repository scope: Cerbanimo executor provider interface and sandbox integration; Kamiya schema-driven form controls, progress polling cards, retry/cancel controls, and accessibility checks.

Dependencies: Packet 005/006 preparation and run contracts.

Primary risk: Repository code execution must not run in the API process.

Estimated size: L

Proof of completion: Production capability is available only with sandbox config, no arbitrary commands are accepted, and browser tests cover form validation, refresh recovery, checks failed, timeout/retry, cancel, and capability unavailable.

## Packet 008: Auth0 Permission Introspection And Settings

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
