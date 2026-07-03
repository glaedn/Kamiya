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

- `GET /automation/templates`
- `POST /automation/actions`
- `GET /actions`
- `GET /automation/validation-report?target=...`

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
