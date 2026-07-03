# Project Canon

Evidence basis: Kamiya@69adfd2 and Cerbanimo@render-deploy ce5eca1. This canon records product-owner decisions plus repository-grounded boundaries. When current code contradicts aspirational documentation, the current code is treated as stronger evidence and the contradiction is recorded in the architecture and risk documents.

## Product Thesis

Kamiya is the conversational Project Management and Automation Assistant for Cerbanimo. Cerbanimo remains the platform of record for identities, permissions, projects, task graphs, automation records, rewards, communities, memory, notifications, and audit trails, while Kamiya interprets intention, collects missing inputs, previews actions, requests confirmation, and renders Cerbanimo results in chat. Evidence: Kamiya@69adfd2: [README.md](../../README.md) :: "Kamiya is a standalone conversational project management and automation assistant"; Kamiya@69adfd2: [server/services/cerbanimoClient.ts](../../server/services/cerbanimoClient.ts) :: `CerbanimoClient`; Cerbanimo@render-deploy ce5eca1: `backend/server.js` :: route registration.

## User Promise

Cami can describe a goal naturally, have Kamiya ask only for genuinely missing project information, confirm a clear action preview, and then see the active tasks, validation status, rewards, and next useful step coming from Cerbanimo's authoritative state.

## First Target User

Cami is the first power user. The initial product should optimize for her as a subscriber and operator who wants project-manager help, automation narration, and direct access to Cerbanimo project and task capabilities without navigating every Cerbanimo screen manually.

## Product Boundaries

| Boundary | Kamiya | Cerbanimo |
| --- | --- | --- |
| Identity | Consumes Auth0 bridge result and stores client session tokens. Evidence: Kamiya@69adfd2: [src/lib/authBridge.ts](../../src/lib/authBridge.ts) :: `startCerbanimoLogin()` | Owns Auth0 login, user creation, permission resolution, API tokens, and user rows. Evidence: Cerbanimo@render-deploy ce5eca1: `src/pages/AuthBridge.jsx` :: `AuthBridgeStart`, `AuthBridgeCallback`; `backend/services/apiAuthService.js` :: `apiAuthenticate()` |
| Conversation | Owns chat UI, intent routing, missing-input loop, response cards, and action previews. Evidence: Kamiya@69adfd2: [src/App.tsx](../../src/App.tsx) :: `App`; [server/services/chatService.ts](../../server/services/chatService.ts) :: `handleChatTurn()` | Stores saved Kamiya chat history in user rows. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/routes/kamiya_chats.js` :: `router.post('/chats')`; `models/kamiya_api.js` :: `createKamiyaApiTables()` |
| Business rules | Must not duplicate platform rules. May shape requests for Cerbanimo endpoints. Evidence: Kamiya@69adfd2: [server/services/cerbanimoClient.ts](../../server/services/cerbanimoClient.ts) :: `createProject()` | Owns project creation, task generation, activation, submission, review, rewards, and notifications. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/routes/projects.js`, `backend/routes/tasks.js`, `backend/controllers/taskController.js`, `backend/services/TaskRoutingService.js` |
| Automation | Presents automation templates and asks Cerbanimo to create actions. Evidence: Kamiya@69adfd2: [server/services/actionPlanner.ts](../../server/services/actionPlanner.ts) :: `previewAutomation()` | Owns durable action, automation run, worker, logs, and retries. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/services/ActionQueueService.js`, `backend/services/AutomationWorkerService.js`, `backend/jobs/workers/automationWorker.js` |
| Rendering | Owns chat-specific cards and controls. Evidence: Kamiya@69adfd2: [server/services/cardFactory.ts](../../server/services/cardFactory.ts) | Owns authoritative render descriptors and page routes. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/routes/platform.js` :: `router.get('/render/page')`; `backend/routes/api_v1/index.js` :: OpenAPI paths |

## Golden-Path Lifecycle

1. Cami describes a wish or goal in Kamiya.
2. Kamiya routes intent and updates a planning draft. Evidence: Kamiya@69adfd2: [server/services/intentRouter.ts](../../server/services/intentRouter.ts) :: `routeIntent()`; [server/services/planningService.ts](../../server/services/planningService.ts) :: `analyzePlanning()`.
3. Kamiya asks only for missing required fields: title, description, and desired outcome. Evidence: Kamiya@69adfd2: [server/ai/prompts.ts](../../server/ai/prompts.ts) :: `buildPlanningPrompt()`.
4. Kamiya creates an action preview and waits for confirmation. Evidence: Kamiya@69adfd2: [server/services/actionPlanner.ts](../../server/services/actionPlanner.ts) :: `previewProjectCreation()`; [server/services/chatService.ts](../../server/services/chatService.ts) :: `isConfirmation()`.
5. Cerbanimo creates the project, stores the outcome, generates a project plan and task graph, inserts tasks, and activates unblocked tasks. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/routes/projects.js` :: `router.post('/create')`, `router.post('/auto-generate')`; `backend/services/taskGenerator.js` :: `autogeneratePlan()`, `autoGenerateTasks()`; `backend/services/TaskRoutingService.js` :: `activateProjectTasks()`.
6. Kamiya polls for active tasks and presents them. Evidence: Kamiya@69adfd2: [server/services/cerbanimoClient.ts](../../server/services/cerbanimoClient.ts) :: `waitForActiveProjectTasks()`; [server/services/chatService.ts](../../server/services/chatService.ts) :: `formatProjectCreatedMessage()`.
7. Human or automated work is submitted. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/routes/tasks.js` :: `router.post('/:taskId/submit')`; `backend/controllers/taskController.js` :: `submitTask()`.
8. Review, validation, approval, rewards, story/chronicle updates, and dependency activation are handled by Cerbanimo. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/controllers/taskController.js` :: `approveTask()`; `backend/services/TaskRoutingService.js` :: `activateProjectTasks()`.
9. Kamiya reports results and proposes the next project cycle only with user approval.

## Automation Classifications

| Classification | Canonical meaning | Current evidence |
| --- | --- | --- |
| Human-driven | Requires a person to do the work and submit proof. | Cerbanimo task lifecycle exists in `backend/routes/tasks.js` and `backend/controllers/taskController.js`. |
| Automatable with required human input | Worker can perform some work after a user supplies target data, credentials, approval, or proof. | Cerbanimo@render-deploy ce5eca1: `backend/services/AutomationWorkerService.js` :: `runDocumentSummary()`, `runProjectPlanGeneration()`, `externalIntegrationBlocked()`. |
| Fully automatable | Worker can run from state and policy without new human content after confirmation. | PARTIAL. `run_quality_checks`, deadline monitoring, blocker detection, and reminders have worker implementations, but idempotency and retry policy are called out as missing by `backend/routes/api_v1/index.js` :: `/automation/validation-report`. |

## Validation And Reward Philosophy

Validation should protect trust without turning Kamiya into an opaque judge. Cerbanimo should record proof, validation events, review state, approvals, challenges, appeals, rewards, skill XP, tokens, and notifications. Kamiya should explain what happened and what remains blocked. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/controllers/taskController.js` :: `submitTask()`, `approveTask()`; `backend/routes/verification_v2.js`; `backend/services/AutomationWorkerService.js` :: `runSubmissionValidation()`.

## Non-Negotiable Principles

- Cerbanimo stores reality; Kamiya understands intention.
- State-changing behavior uses preview and confirmation before mutation.
- Cerbanimo APIs are the only mutation path for Kamiya.
- Permissions and policies must be visible before execution.
- AI can route, draft, summarize, and explain, but platform logic calculates authoritative statistics, rewards, activation, and permissions.
- Durable actions, automation runs, audit logs, and retries belong in Cerbanimo.
- Work memory must be relevant to projects, tasks, preferences, automations, or community participation.
- Unknown behavior must be documented as `UNKNOWN`, not upgraded into a claim.

## Anti-Vision

Kamiya is not a nagging productivity monitor, an opaque autonomous boss, a surveillance layer, a generic chatbot, a pay-to-win task completion machine, a system that mutates state without confirmation, or a hidden scoring and manipulation surface.

## Launch-Critical Modes

| Mode | Canonical role | Current status |
| --- | --- | --- |
| Auto | Selects the most appropriate launch-critical behavior. | PARTIAL in Kamiya mode state. Evidence: Kamiya@69adfd2: [server/services/modeService.ts](../../server/services/modeService.ts). |
| Planner | Turns goals into project drafts and action previews. | PARTIAL. Evidence: Kamiya@69adfd2: [server/services/planningService.ts](../../server/services/planningService.ts). |
| Reviewer | Explains validation and review state. | SCAFFOLD. Evidence: Kamiya@69adfd2: [shared/types.ts](../../shared/types.ts) :: `AgentMode`. |
| Automator | Creates automation previews and asks Cerbanimo to queue actions. | PARTIAL. Evidence: Kamiya@69adfd2: [server/services/actionPlanner.ts](../../server/services/actionPlanner.ts) :: `previewAutomation()`. |

Manager, Builder, and Coach are descriptive until they have distinct policy and behavior.

## Explicit First-Cycle Exclusions

Slack, voice, payments, and blockchain are deferred from the first cycle. Evidence: product-owner packet. Cerbanimo contains crypto and wallet groundwork in `backend/routes/wallets.js`, `backend/services/WalletService.js`, and `ethers` dependencies, but these are not launch-critical for Kamiya's first cycle.

## Glossary

| Term | Canonical definition |
| --- | --- |
| Action | A durable, permission-aware unit of intended mutation or automation in Cerbanimo. |
| Action preview | A user-facing summary of a proposed mutation before confirmation. |
| Active task | A Cerbanimo task whose dependencies have cleared and whose status begins with active, urgent, ready, open, available, or in_progress for Kamiya display. |
| Automation run | A Cerbanimo worker execution record tied to an action and logs. |
| Cami | First target power user and product-owner persona. |
| Cerbanimo | Platform of record for coordination, projects, tasks, communities, rewards, memory, automation, and audit state. |
| Function schema | Cerbanimo-owned contract describing callable platform capabilities. |
| Golden path | The first intended journey from natural-language goal to project, active tasks, validation, reward, and next cycle. |
| Kamiya | Conversational PMAA and client-specific interface for Cerbanimo. |
| Memory | Work-relevant durable context owned by Cerbanimo, not arbitrary chat chatter. |
| PMAA | Project Management and Automation Assistant. |
| Render descriptor | Cerbanimo-owned page/card description that clients can render. |
| Work packet | A bounded implementation or audit unit with explicit scope and proof. |
