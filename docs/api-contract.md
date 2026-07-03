# Kamiya API Contract

Kamiya exposes a small client-facing API. Web, Discord, Slack, Google Chat, and future clients should call the same endpoints.

## `POST /api/chat/turn`

Routes a user message, updates conversational session state, and returns a renderable assistant message.

Request:

```json
{
  "message": "/plan Build a community garden",
  "history": [],
  "session": {},
  "auth": {
    "isLoggedIn": true,
    "userId": "user_123",
    "displayName": "Glaed",
    "cerbanimoApiUrl": "https://cerbanimo-api.example.com",
    "cerbanimoToken": "JWT",
    "permissions": ["projects:create"]
  }
}
```

Response:

```json
{
  "message": {
    "id": "msg_123",
    "role": "assistant",
    "content": "What timeline or deadline should I plan around?",
    "createdAt": "2026-07-01T21:00:00.000Z",
    "cards": []
  },
  "session": {
    "planningDraft": {
      "title": "Build a community garden"
    }
  }
}
```

## `GET /api/health`

Returns service health and whether live Gemini routing is configured.

## Response Cards

All clients should render the same card schema:

- `project`
- `task`
- `community`
- `profile`
- `stats`
- `approval`
- `timeline`
- `quest_summary`
- `search_results`
- `action_preview`
- `workflow_progress`
- `workflow_failure`
- `help`

Card actions can be converted into web clicks, Discord buttons, Slack block actions, or Google Chat cards.

## Action Preview

Every modifying action is represented as:

```json
{
  "id": "action_123",
  "kind": "create_project",
  "title": "Create project: Community Garden",
  "summary": "Kamiya will create a Cerbanimo project.",
  "risk": "low",
  "destructive": false,
  "payload": {},
  "requiredPermissions": ["projects:create"],
  "createdAt": "2026-07-01T21:00:00.000Z"
}
```

Executions only occur after user confirmation.

## Golden Project Bootstrap

For project creation, Kamiya now uses Cerbanimo `/api/v1` action endpoints exclusively.

Canonical sequence:

```text
POST /api/v1/actions/preview
POST /api/v1/actions/:id/confirm
GET  /api/v1/actions/:id
POST /api/v1/actions/:id/cancel
POST /api/v1/actions/:id/retry
GET  /api/v1/actions
```

The preview intent is:

```json
{
  "functionName": "projects.bootstrap",
  "arguments": {
    "name": "Build a Democratic Digital Economy",
    "description": "Design and implement...",
    "outcomeStatement": "A working platform...",
    "dueDate": "2027-01-02",
    "tags": ["cooperative economics"],
    "generationMode": "plan_then_tasks"
  }
}
```

Kamiya treats client session state as a resumable cache only. The persisted Cerbanimo action/workflow detail is authoritative for status, project IDs, tasks, active tasks, retryability, and failures.

Supported workflow states:

- `queued`
- `running`
- `retry_wait`
- `blocked`
- `failed`
- `completed`
- `cancelled`

Rendered bootstrap stages:

- `validateInput`
- `generateProjectPlan`
- `generateTaskGraph`
- `validateTaskGraph`
- `persistProjectGraph`
- `activateRootTasks`
- `finalizeAction`

Golden Conversation v1 verification covers this contract through:

- `npm run test:e2e:contract`: deterministic browser contract against a stateful local Cerbanimo fixture.
- `npm run test:e2e:integration`: real Kamiya React and Express, real Cerbanimo `/api/v1`, isolated PostgreSQL, real pg-boss worker, deterministic provider at the external generation seam.
- `npm run test:e2e:failure`: timeout retry, invalid graph block, cancel-before-persist, network interruption, duplicate confirmation, missing auth, and cross-user hydration denial.

The real-stack profile asserts that the golden project path does not call `/platform`, `/projects/create`, or `/projects/auto-generate`.

## Task Automation Classification

Cerbanimo `/api/v1` task payloads include a canonical `automation` object on task list/detail responses and on `GET /api/v1/actions/:id` bootstrap hydration.

```json
{
  "id": 203,
  "name": "Run baseline repository quality checks",
  "status": "active-unassigned",
  "automation": {
    "classification": "fully_automatable",
    "confidenceBand": "high",
    "rationale": "The task is bounded digital work with a known capability and expected quality-check report.",
    "requiredHumanInputs": [],
    "requirements": {
      "capabilities": ["github.run_quality_checks"],
      "tools": ["git", "npm"],
      "externalServices": ["github"],
      "permissions": ["repository:read", "checks:run"],
      "expectedArtifacts": ["quality-check-report"],
      "networkAccess": "restricted"
    },
    "validationRequirements": [],
    "source": "generated",
    "version": "task-automation-v1",
    "classifiedAt": "2026-07-03T00:00:00.000Z",
    "findings": []
  }
}
```

Allowed `classification` values are `human_driven`, `assisted_automation`, and `fully_automatable`. Missing or malformed automation metadata must be treated as `human_driven` by clients.

Kamiya renders this metadata but does not infer execution permission from it. Capability availability, actor scope, input completion, executor configuration, and policy state come from Cerbanimo task automation context.

Task automation preparation and first execution now use Cerbanimo `/api/v1`:

```text
GET  /api/v1/tasks/:taskId/automation
POST /api/v1/tasks/:taskId/automation/preparations
POST /api/v1/tasks/:taskId/automation/preparations/:preparationId/preview
POST /api/v1/actions/:id/confirm
GET  /api/v1/automation/runs/:id
```

Kamiya renders `Prepare with Kamiya` for assisted tasks and `Review quality checks` for `github.run_quality_checks`. A quality-check run can return `checks_passed`, `checks_failed`, `blocked`, `cancelled`, or `executor_failed`. Only `checks_passed` submits the task for review in Cerbanimo; it does not award rewards or mark the task complete.

## Phase 3 Automation Contract

Automation previews include:

```json
{
  "kind": "run_automation",
  "payload": {
    "workflowType": "create_github_issues",
    "request": "/automation create GitHub issues from this plan",
    "audit": {
      "requiresPreview": true,
      "requiresConfirmation": true,
      "logIntent": true,
      "notifyOnCompletion": true
    }
  }
}
```

Kamiya currently recognizes:

- `research_competitors`
- `summarize_documents`
- `generate_project_plan`
- `create_github_issues`
- `generate_pull_request`
- `deploy_staging`
- `monitor_deadlines`
- `detect_blockers`
- `schedule_reminder`
- `validate_submission`
- `review_pull_request`
- `run_quality_checks`
- `custom`

Expected Cerbanimo endpoints:

- `GET /api/v1/automation/templates`
- `POST /api/v1/automation/actions`
- `GET /api/v1/actions`
- `GET /api/v1/automation/validation-report?target=...`

## Phase 4 Client Adapter Contract

Kamiya exposes channel adapter scaffolds:

- `POST /api/adapters/discord`
- `POST /api/adapters/slack`
- `POST /api/adapters/google-chat`

Each adapter normalizes the inbound payload to:

```json
{
  "channel": "discord",
  "text": "/task",
  "externalUserId": "external_user",
  "workspaceId": "workspace",
  "displayName": "Glaed"
}
```

And returns:

```json
{
  "channel": "discord",
  "text": "Here is the current task snapshot.",
  "cards": []
}
```

Real production adapters must add channel signing verification and Cerbanimo identity linking before execution.

## Agent Modes

Supported modes:

- `auto`
- `planner`
- `builder`
- `reviewer`
- `automator`
- `manager`
- `coach`

Mode is stored in `KamiyaSessionState.mode` and should eventually persist to Cerbanimo user/team preferences.
