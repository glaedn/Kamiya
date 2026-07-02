# Cerbanimo Platform Requirements For Kamiya

Kamiya is implemented as a standalone API client. To support the full roadmap, Cerbanimo should expose the following documented platform APIs and features.

## Existing Reference Surface

The reference repository already includes useful foundations:

- Auth routes and JWT middleware.
- Project, task, community, profile, skills, rewards, notifications, integrations, and intelligence routes.
- AI gateway/orchestration services.
- Task lifecycle logic for claiming, submitting, approving, rejecting, and reviewing work.
- Notification and event services.
- Background job/workflow infrastructure.

## New Or Formalized APIs Needed

### `POST /ai/intent-route`

Central platform endpoint for model-independent intent routing. Kamiya can route locally today, but this should become a Cerbanimo API so future clients share a single intent taxonomy.

### `POST /ai/planning/analyze`

Accepts a user idea plus draft state. Returns fulfilled fields, missing fields, recommended next questions, and a ready-to-create flag.

### `GET /capabilities/functions`

Returns callable Cerbanimo functions, permissions, parameter schemas, confirmation policy, and card render hints.

### `POST /actions/preview`

Creates an auditable pending action object without executing it.

### `POST /actions/:id/confirm`

Executes a pending action after confirmation, then logs the result and emits notifications.

### `POST /actions/:id/cancel`

Cancels a pending action.

### `GET /actions`

Lists action queue items for a user, project, community, or automation run.

### `POST /automation/actions`

Creates auditable automation work such as research, document summarization, GitHub issue generation, PR review, deployment, deadline monitoring, and validation workflows.

### `GET /automation/templates`

Returns workflow definitions, required permissions, required inputs, confirmation policy, and render hints for automation cards.

### `GET /automation/validation-report`

Returns a validation report for a task submission, pull request, document, or quality-check target. Statistics and pass/fail logic should be produced by Cerbanimo application services, not by Kamiya.

### `GET /search`

Unified conversational search across projects, tasks, communities, users, skills, needs, services, and bounties.

### `GET /stats/me`

Traditional application-logic stats endpoint for experience, levels, skills, token balances, rankings, contribution history, project completion, and quest streaks.

### `POST /memory`

Stores long-term work memory with strict categories:

- Project goals
- Preferences
- Relevant work conversations
- Automation history
- Task history
- Community participation

Kamiya should not store casual chatter.

### `GET /render/page`

Returns renderable page descriptors/cards for profile, project, task, dashboard, timeline, approval, and statistics views.

## Authentication Needs

- OAuth/OIDC flow for third-party clients.
- Scoped API tokens for chat clients and bots.
- Bot identity mapping for Discord, Slack, and Google Chat users.
- Permission introspection endpoint.

## Auth0 Bridge For Kamiya Web Login

Kamiya now expects Cerbanimo to provide a popup auth bridge so the user can log in through Cerbanimo/Auth0 without manually pasting tokens into Kamiya.

### Cerbanimo Routes

#### `GET /auth/bridge/start`

Accepts:

- `return_origin`: the Kamiya browser origin that should receive the login result.
- `nonce`: a Kamiya-generated opaque value that must be echoed back after login.

Behavior:

- Validate `return_origin` against `VITE_AUTH_BRIDGE_ALLOWED_ORIGINS`.
- Store `return_origin` and `nonce` in short-lived Auth0 transaction state.
- Redirect the popup to the existing Cerbanimo Auth0 login flow.

#### `GET /auth/bridge/callback`

Behavior:

- Complete the Auth0 callback.
- Mint or retrieve the Cerbanimo Auth0 API access token for the logged-in user.
- Render a minimal bridge page that calls `window.opener.postMessage(message, return_origin)`.
- Close the popup after posting the message.

Success message contract:

```ts
{
  type: "CERBANIMO_AUTH_BRIDGE_SUCCESS";
  tokenType: "Bearer";
  accessToken: string;
  expiresAt?: string | number;
  audience?: string;
  user?: {
    sub?: string;
    name?: string;
    nickname?: string;
    email?: string;
    picture?: string;
  };
  nonce: string;
}
```

Error message contract:

```ts
{
  type: "CERBANIMO_AUTH_BRIDGE_ERROR";
  error?: string;
  errorDescription?: string;
  message?: string;
  nonce: string;
}
```

### Cerbanimo/Auth0 Configuration

- Add Auth0 Allowed Callback URL: `http://localhost:3000/auth/bridge/callback`
- Add the production equivalent callback URL.
- Set Cerbanimo frontend env: `VITE_AUTH_BRIDGE_ALLOWED_ORIGINS=http://localhost:5173,<production-kamiya-origin>`
- Set Cerbanimo backend env: `KAMIYA_ALLOWED_ORIGINS=http://localhost:5173,<production-kamiya-origin>`
- Ensure the returned `accessToken` is accepted by Cerbanimo API endpoints through `Authorization: Bearer <token>`.

## Notification Needs

- User notification preferences.
- Notification priority policy.
- Client-channel fanout for web, Discord, Slack, and Google Chat.
- Celebration templates for task approval, level gain, badges, tokens, milestones, and project completion.

## Audit Requirements

Every mutation and automation must store:

- Actor user or bot identity
- Source client
- Intent JSON
- Preview payload
- Confirmation event
- Execution result
- Related project/task/community IDs
- Notifications emitted

## Phase 3 Workflow Requirements

Cerbanimo should own execution for:

- Competitor research with source capture.
- Document summarization and artifact attachment.
- Project-plan and implementation-task generation.
- GitHub issue creation.
- Pull request generation.
- Staging deployment.
- Deadline monitoring.
- Blocker detection.
- Scheduled reminders.
- Submitted-work validation.
- Pull request review.
- Quality checks.

Kamiya may classify user intent and request previews, but Cerbanimo must create the Action object, execute workers, persist logs, and emit notifications.

## Recommended Model Configuration

As of the official Google AI model docs checked on July 1, 2026, `gemini-3.1-flash-lite` is the stable Flash-Lite model with structured outputs, function calling, and thinking support. `gemini-2.5-flash-lite` is also stable, but Kamiya defaults to `gemini-3.1-flash-lite` for the initial implementation.

Sources:

- [Gemini 3.1 Flash-Lite](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)
- [Gemini API structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
