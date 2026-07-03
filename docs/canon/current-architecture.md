# Current Architecture

Evidence basis: Kamiya@69adfd2 on branch `kamiya/m0-project-canon-architecture`; Cerbanimo@render-deploy ce5eca1. This file describes current repository behavior, not intended future behavior unless labeled as such.

## 1. System Context

```mermaid
flowchart LR
  User["User / Cami"] --> KamiyaWeb["Kamiya React web app"]
  KamiyaWeb --> KamiyaApi["Kamiya Express API"]
  KamiyaApi --> Gemini["Gemini JSON API when configured"]
  KamiyaApi --> CerbApi["Cerbanimo Express API"]
  CerbFrontend["Cerbanimo React frontend"] --> Auth0["Auth0"]
  KamiyaWeb --> AuthBridge["Cerbanimo auth bridge popup"]
  AuthBridge --> Auth0
  CerbApi --> Postgres["PostgreSQL"]
  CerbApi --> PgBoss["pg-boss queues"]
  PgBoss --> Workers["Cerbanimo workers"]
  CerbApi --> B2["Backblaze B2"]
  CerbApi --> SocketIo["Socket.io notifications"]
  CerbApi --> Discord["Discord adapter"]
```

### Subsystem Summary

| Subsystem | Owner | Entrypoints | Persistence | Services/modules | Auth boundary | Execution mode | Failure behavior | Risks or contradictions |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Kamiya web | Kamiya | [src/App.tsx](../../src/App.tsx) :: `App` | Browser storage for auth/session; Cerbanimo for saved chats | [src/lib/kamiyaApi.ts](../../src/lib/kamiyaApi.ts), [src/lib/authBridge.ts](../../src/lib/authBridge.ts) | Cerbanimo Auth0 bridge token is passed to Kamiya API | Synchronous browser requests | Shows thrown API error as assistant message | Client carries bearer token to Kamiya API; service-token strategy still unresolved. |
| Kamiya API | Kamiya | [server/index.ts](../../server/index.ts) :: `/api/chat/turn`, `/api/chats/*`, `/api/adapters/*` | None durable except via Cerbanimo chat endpoints | [server/services/chatService.ts](../../server/services/chatService.ts), [server/services/cerbanimoClient.ts](../../server/services/cerbanimoClient.ts) | Trusts auth context supplied by browser/channel request | Synchronous | Express error handler returns `{ ok:false,error }` | Channel signatures are configurable but not enforced by default in Render env. |
| Cerbanimo API | Cerbanimo | `backend/server.js` route registration | PostgreSQL | `backend/routes/*`, `backend/services/*` | Auth0 JWT, scoped API tokens under `/api/v1`, route middleware | Synchronous plus queued workers | Global error handler returns nested error object | Root routes and `/api/v1` have overlapping functionality and different envelopes. |
| Workers | Cerbanimo | `backend/server.js` :: `boss.start()`, `startWorkers()`, `startEventWorker()` | pg-boss tables plus workflow/automation tables | `backend/jobs/startWorkers.js`, `backend/jobs/workers/*`, `backend/workers/eventWorker.js` | Runs inside backend process | Queued and scheduled | Logs queue start errors; many workers catch and log per job | Render blueprint has only web services, no dedicated worker service. |

## 2. Current Web Request Flow

```mermaid
sequenceDiagram
  participant Browser as Kamiya browser
  participant KApi as Kamiya API
  participant Cerb as Cerbanimo API
  participant DB as PostgreSQL
  Browser->>KApi: POST /api/chat/turn
  KApi->>KApi: validate zod request
  KApi->>Cerb: optional Cerbanimo API call with bearer token
  Cerb->>DB: read/write platform state
  Cerb-->>KApi: JSON response
  KApi-->>Browser: ChatTurnResponse
```

Evidence: Kamiya@69adfd2: [server/index.ts](../../server/index.ts) :: `chatTurnSchema`, `/api/chat/turn`; [src/lib/kamiyaApi.ts](../../src/lib/kamiyaApi.ts) :: `sendChatTurn()`; Cerbanimo@render-deploy ce5eca1: `backend/server.js` :: `app.use('/projects'...)`, `app.use('/tasks'...)`, `app.use('/kamiya'...)`.

Failure behavior: Kamiya API returns HTTP 400 for zod or service errors; the frontend appends the error text as an assistant message. Cerbanimo route errors are mixed: root routes often return `{ message }` or `{ error }`, while `/api/v1` and `/platform` wrap with `apiEnvelope`.

## 3. Current Kamiya Chat-Turn Flow

```mermaid
flowchart TD
  A["User message in src/App.tsx"] --> B["POST /api/chat/turn"]
  B --> C["handleChatTurn()"]
  C --> D{"Pending action and confirmation?"}
  D -- yes --> E["CerbanimoClient.executeAction()"]
  D -- no --> F["routeIntent()"]
  F --> G{"Planning turn?"}
  G -- yes --> H["analyzePlanning()"]
  H --> I{"Required fields ready?"}
  I -- no --> J["Ask missing question + quest card"]
  I -- yes --> K["previewProjectCreation() + action card"]
  G -- no --> L["Search/tasks/stats/profile/automation/render cards"]
  E --> M["persistChatTurn()"]
  J --> M
  K --> M
  L --> M
  M --> N["Cerbanimo /kamiya/chats when logged in"]
```

Owner: Kamiya conversation layer. Entrypoints: [src/App.tsx](../../src/App.tsx) :: `submitMessage()`, [server/index.ts](../../server/index.ts) :: `/api/chat/turn`. Persistence: Cerbanimo user row field `kamiya_chats`, created by Cerbanimo@render-deploy ce5eca1: `models/kamiya_api.js` :: `createKamiyaApiTables()`. Primary modules: [server/services/chatService.ts](../../server/services/chatService.ts), [server/services/intentRouter.ts](../../server/services/intentRouter.ts), [server/services/planningService.ts](../../server/services/planningService.ts), [server/services/actionPlanner.ts](../../server/services/actionPlanner.ts), [server/services/cardFactory.ts](../../server/services/cardFactory.ts). Auth boundary: Kamiya request carries a `KamiyaAuthContext`; Cerbanimo verifies bearer tokens when Kamiya persists chats or executes actions. Execution: synchronous request/response, with a 30-second polling loop for newly active project tasks. Failure behavior: missing Cerbanimo API credentials block mutation and return explicit text; search, tasks, profile, stats, notifications, action queue, and validation report can return mocked fallback data. Risk: action history in Kamiya session is local and not durable unless Cerbanimo `/platform` or `/api/v1` action APIs are used.

## 4. Project Creation And Task Generation Flow

```mermaid
sequenceDiagram
  participant U as User
  participant K as Kamiya
  participant P as Cerbanimo projects route
  participant TG as taskGenerator
  participant TR as TaskRoutingService
  participant DB as PostgreSQL
  U->>K: Describe goal
  K->>K: planning draft and preview
  U->>K: confirm
  K->>P: POST /projects/create
  P->>DB: insert project
  P->>DB: create outcome
  P-->>K: project row
  K->>P: POST /projects/auto-generate
  P->>TG: autogeneratePlan() or autoGenerateTasks()
  TG-->>P: generated tasks
  P->>DB: insert tasks and dependencies
  P->>TR: activateProjectTasks()
  TR->>DB: activate unblocked tasks
  K->>P: GET /projects/:id/task-status until active or timeout
```

Current implementation: Kamiya@69adfd2: [server/services/cerbanimoClient.ts](../../server/services/cerbanimoClient.ts) :: `createProject()`, `generateAndWaitForProjectTasks()`, `waitForActiveProjectTasks()`. Cerbanimo@render-deploy ce5eca1: `backend/routes/projects.js` :: `router.post('/create')`, `router.post('/auto-generate')`, `router.get('/:projectId/task-status')`; `backend/services/taskGenerator.js` :: `autogeneratePlan()`, `autoGenerateTasks()`; `backend/services/TaskRoutingService.js` :: `activateProjectTasks()`.

Observed breakpoints: project creation and auto-generation are separate HTTP requests. If task generation fails or returns no active tasks, Kamiya waits up to 30 seconds and shows a retry. Cerbanimo retries reuse an existing task graph when present. The project route sanitizes generated task names, but the LLM prompt remains able to produce malformed dependency graphs or missing fields.

## 5. Task Claim, Submission, Review, Approval, Reward, Activation

```mermaid
flowchart TD
  A["GET active tasks"] --> B["PUT /tasks/:taskId/accept"]
  B --> C["taskController.acceptTask()"]
  C --> D["assigned status"]
  D --> E["POST /tasks/:taskId/submit"]
  E --> F["taskController.submitTask()"]
  F --> G["status submitted + peer reviewers"]
  G --> H["PUT /tasks/:taskId/approve or review/pm-approve"]
  H --> I["taskController.approveTask()"]
  I --> J{"verification required?"}
  J -- yes --> K["pending_verification"]
  J -- no --> L["completed"]
  L --> M["XP/tokens/story/notification"]
  M --> N["TaskRoutingService.activateProjectTasks()"]
```

Owner: Cerbanimo. Entrypoints: Cerbanimo@render-deploy ce5eca1: `backend/routes/tasks.js` :: `router.put('/:taskId/accept')`, `router.post('/:taskId/submit')`, `router.put('/:taskId/approve')`, `router.put('/:taskId/review')`, `router.put('/:taskId/pm-approve')`. Persistence: `tasks`, `users`, `notifications`, token ledger arrays, story tables, verification tables. Primary modules: `backend/controllers/taskController.js` :: `acceptTask()`, `submitTask()`, `approveTask()`; `backend/services/TaskRoutingService.js` :: `activateProjectTasks()`. Auth boundary: `/tasks` is wrapped with Auth0 `jwtCheck` and `resolveUser` in `backend/server.js`; some route methods also require Discord-linked identity through `IdentityGateService.requireDiscordLinked()`. Execution: synchronous route work with direct DB writes and notifications; dependency activation is synchronous after approval. Failure behavior: route returns status-specific errors for missing platform user, proof links, non-submitted approval, and identity-link failures. Risk: validation and review paths are broad and complex; some validation moves tasks to `pending_verification`, but the final validation/appeal pipeline is not proven end to end from the inspected route alone.

## 6. Current Worker And Scheduling Topology

```mermaid
flowchart LR
  Server["backend/server.js"] --> Boss["backend/jobs/boss.js"]
  Boss --> Start["backend/jobs/startWorkers.js"]
  Start --> Agent["agent-execution"]
  Start --> Auto["automation-execution"]
  Start --> Domain["governance-execution / chronicle-generation"]
  Start --> Scheduled["scheduled-tasks"]
  Server --> EventWorker["backend/workers/eventWorker.js"]
  EventWorker --> EventBus["EventBusService civic-events"]
```

| Mechanism | Current state | Evidence |
| --- | --- | --- |
| pg-boss | Active. Queues are created, workers are started, and schedules are registered from the API process. | Cerbanimo@render-deploy ce5eca1: `backend/jobs/boss.js`, `backend/jobs/startWorkers.js`, `backend/server.js` :: `boss.start()` |
| pg-boss scheduled jobs | Active in code. Daily/monthly/hourly jobs are scheduled on startup. | `backend/jobs/startWorkers.js` :: `boss.schedule(...)` |
| Automation worker | Active in code. Processes `automation-execution` and calls `AutomationWorkerService.run()`. | `backend/jobs/workers/automationWorker.js` |
| Agent worker | Active in code. Processes `agent-execution`. | `backend/jobs/workers/agentWorker.js` |
| Domain workers | Active in code. Governance and chronicle queues. | `backend/jobs/workers/domain/domainWorkers.js` |
| Event bus | Active with pg-boss plus local fallback. | `backend/services/EventBusService.js`, `backend/workers/eventWorker.js` |
| BullMQ/ioredis | Dependency only or deprecation candidate. No active imports found outside `package.json`. | Cerbanimo@render-deploy ce5eca1: `package.json` includes `bullmq` and `ioredis`; `rg` found no active backend imports. |
| node-cron | Dependency only or deprecation candidate. Comment states scheduled tasks moved to pg-boss. | Cerbanimo@render-deploy ce5eca1: `package.json` includes `node-cron`; `backend/server.js` :: "Scheduled tasks moved to pg-boss". |
| Render worker service | Not configured. Render has backend web and frontend static services only. | Cerbanimo@render-deploy ce5eca1: `render.yaml`. |

## 7. Current AI Provider And Prompt Flow

Kamiya uses Gemini through a model-independent wrapper with deterministic fallback. Evidence: Kamiya@69adfd2: [server/ai/geminiClient.ts](../../server/ai/geminiClient.ts) :: `generateGeminiJson()`; [server/services/localIntentRouter.ts](../../server/services/localIntentRouter.ts); [server/services/planningService.ts](../../server/services/planningService.ts); [server/services/chatTitleService.ts](../../server/services/chatTitleService.ts). Prompts live in [server/ai/prompts.ts](../../server/ai/prompts.ts). Failure behavior: if `KAMIYA_GEMINI_API_KEY` is missing, `generateGeminiJson()` returns null and services use local logic.

Cerbanimo uses Gemini directly in `backend/services/taskGenerator.js` for task and project plan generation, and `backend/services/AIGatewayService.js` for agents/intelligence. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/services/taskGenerator.js` :: `autoGenerateTasks()`, `autogeneratePlan()`; `backend/services/AIGatewayService.js` :: `analyze()`. Failure behavior: task generator throws and project route returns 500/502; AIGateway throws after logging.

Risk: Kamiya and Cerbanimo have separate prompt stacks and model names. Kamiya uses `KAMIYA_GEMINI_MODEL` default `gemini-3.1-flash-lite`; Cerbanimo task generator also uses `gemini-3.1-flash-lite`, while `AIGatewayService` defaults to `gemini-1.5-flash`.

## 8. Current Notification And Discord Flow

Cerbanimo owns notifications. `sendNotification()` writes to `notifications` and emits Socket.io where available. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/services/NotificationService.js` :: `sendNotification()`; `backend/server.js` :: `setIo(io)` and socket rooms. Frontend notification consumption exists in `src/hooks/useNotifications.js`, `src/pages/SiteNav.jsx`, and `src/pages/NotificationProvider.jsx`.

Discord is an active integration adapter in code. Evidence: Cerbanimo@render-deploy ce5eca1: `backend/server.js` :: `IntegrationManager.registerAdapter(DiscordAdapter)`; `backend/services/integrations/adapters/DiscordAdapter.js`; `backend/routes/discord_config.js`; `backend/services/integrations/core/IntegrationManager.js`. Failure behavior: adapter logs initialization and send failures; readiness depends on Discord env/config. Risk: Kamiya has channel adapter endpoint scaffolds in [server/index.ts](../../server/index.ts) but no full bot-token implementation.

## 9. Storage And File-Upload Flow

```mermaid
flowchart TD
  A["Frontend form upload"] --> B["Multer route"]
  B --> C["local uploads temp file"]
  C --> D["Backblaze B2 uploadFile()"]
  D --> E["DB stores filename or URL"]
  E --> F["generatePrivateDownloadUrl() for reads"]
```

Owner: Cerbanimo. Entrypoints: Cerbanimo@render-deploy ce5eca1: `backend/routes/profile.js` :: `router.post('/', upload.single('profilePicture'))`; `backend/routes/rewards.js` :: `router.post('/badges/create')`. Persistence: file bytes in B2, filename/metadata in PostgreSQL user or reward fields. Primary service: `backend/utils/b2.js` :: `uploadFile()`, `generatePrivateDownloadUrl()`. Auth boundary: parent routes are protected by `jwtCheck` in `backend/server.js`. Execution: synchronous upload during HTTP request. Failure behavior: B2 upload error logs and returns/throws; profile update may fail if B2 fails. Risk: the repo includes committed files under `backend/uploads/**`, which contradicts a pure external-storage posture.

## 10. Deployment Topology

### Local

```mermaid
flowchart LR
  KWeb["Kamiya Vite 5173"] --> KApi["Kamiya API 4177"]
  KApi --> CApi["Cerbanimo API 4000"]
  CWeb["Cerbanimo Vite 3000"] --> CApi
  CWeb --> Auth0["Auth0 dev tenant"]
  CApi --> DB["Postgres / Neon"]
```

Evidence: Kamiya@69adfd2: [README.md](../../README.md) and [package.json](../../package.json) scripts; Cerbanimo@render-deploy ce5eca1: `README.md`, `backend/server.js`.

### Render

```mermaid
flowchart LR
  K["Render web service: kamiya"] --> CApi["Render web service: cerbanimo-api"]
  CStatic["Render static site: cerbanimo"] --> CApi
  CApi --> Pg["PostgreSQL via DATABASE_URL or POSTGRES_URL"]
```

Evidence: Kamiya@69adfd2: [render.yaml](../../render.yaml); Cerbanimo@render-deploy ce5eca1: `render.yaml`. Risk: Cerbanimo workers run in the API process because no dedicated Render worker service exists. Cerbanimo `render.yaml` sets `DATABASE_URL generateValue`, while backend `server.js` requires `POSTGRES_URL`, `GEMINI_API_KEY`, and `BACKEND_URL`; `boss.js` accepts either `POSTGRES_URL` or `DATABASE_URL`.
