# Cerbanimo Implementation Plan For Kamiya

This plan covers the Cerbanimo platform changes needed to support Kamiya as a standalone API client through Phase 4.

## Goal

Cerbanimo remains the platform of record. Kamiya remains a portable conversational client.

Cerbanimo should own:

- Authentication and identity mapping.
- Permissions and policy checks.
- Intent/function registries shared by all clients.
- Project, task, community, stats, memory, rewards, and notification business logic.
- Action queue persistence, audit logs, workers, and automation execution.
- Client/channel notification fanout.

Kamiya should own:

- Conversation UX.
- Client-specific rendering.
- Intent routing requests.
- Missing-input loops.
- Action previews and user confirmations.
- Calling documented Cerbanimo APIs.

## Milestone 1: Public API Hardening

Deliverables:

- Publish OpenAPI docs for existing project, task, community, profile, stats, notification, and search endpoints.
- Normalize response envelopes: `{ ok, data, error, requestId }`.
- Add API versioning under `/api/v1`.
- Add scoped API tokens for third-party clients.
- Add permission introspection endpoint: `GET /api/v1/auth/permissions`.

Acceptance:

- Kamiya can authenticate without direct database access.
- Every read/write used by Kamiya has a documented endpoint.

## Milestone 2: Intent And Function Registry

Deliverables:

- `POST /api/v1/ai/intent-route`
- `POST /api/v1/ai/planning/analyze`
- `GET /api/v1/capabilities/functions`
- Versioned prompt registry for intent routing, planning, and function planning.
- Function schemas for projects, tasks, communities, stats, memory, navigation, and automation.

Acceptance:

- Kamiya can swap local/Gemini routing for Cerbanimo-hosted routing.
- Discord, Slack, Google Chat, and SDK clients receive the same intent taxonomy.

## Milestone 3: Action Queue And Audit Log

Deliverables:

- `POST /api/v1/actions/preview`
- `POST /api/v1/actions/:id/confirm`
- `POST /api/v1/actions/:id/cancel`
- `GET /api/v1/actions`
- Action tables storing intent JSON, preview payload, confirmation event, execution result, source client, actor identity, and notifications emitted.

Acceptance:

- No modifying action executes without preview and confirmation.
- Destructive actions require explicit higher-risk confirmation.
- Kamiya action history can be hydrated from Cerbanimo instead of local browser state.

## Milestone 4: Automation Workers

Deliverables:

- `GET /api/v1/automation/templates`
- `POST /api/v1/automation/actions`
- `GET /api/v1/automation/runs/:id`
- `GET /api/v1/automation/validation-report`
- Worker implementations for competitor research, document summaries, project-plan generation, GitHub issues, PR review, quality checks, deadline monitoring, blocker detection, reminders, submission validation, and staging deploy hooks.

Acceptance:

- Every automation creates a persisted Action object.
- Worker logs are auditable.
- Automation results can be rendered as Kamiya cards.

## Milestone 5: Memory And Render API

Deliverables:

- `POST /api/v1/memory`
- `GET /api/v1/memory/relevant`
- `GET /api/v1/render/page`
- `GET /api/v1/render/cards`
- Work-relevant memory policies and retention rules.

Acceptance:

- Kamiya can retrieve relevant work memory without storing casual chatter.
- Project, profile, task, dashboard, timeline, approval, and stats views can render inside chat.

## Milestone 6: Multi-Platform Identity

Deliverables:

- External identity mapping table for Discord, Slack, Google Chat, web, voice, and SDK clients.
- Bot installation records per workspace/community.
- Channel signing verification.
- Channel-specific permission scopes.
- Notification fanout preferences.

Acceptance:

- A Discord/Slack/Google Chat user maps to the correct Cerbanimo user.
- Channel messages respect the same permissions as web.

## Milestone 7: Agent Modes And Background Agents

Deliverables:

- Persisted user/team default agent mode.
- Mode policy registry: Planner, Builder, Reviewer, Automator, Manager, Coach.
- Scheduled automation triggers.
- Background agent run records.
- Escalation policy for blocked tasks and deadline risk.

Acceptance:

- Kamiya can switch modes explicitly or let Cerbanimo choose.
- Background agents never mutate state without policy and audit records.

## Suggested Sequence

1. API docs and auth scopes.
2. Action queue persistence.
3. Search/profile/stats/render endpoints.
4. Automation templates and first worker: `run_quality_checks`.
5. GitHub integration: issue creation and PR review.
6. Memory API.
7. Discord bot identity mapping.
8. Slack and Google Chat parity.
9. Scheduled/background agents.
10. Public TypeScript SDK package.

## Risks

- Bot identity mapping can create permission leaks if external users are not linked carefully.
- AI-generated plans can become business logic if function schemas are not authoritative.
- Automation workers need idempotency and retry policy from day one.
- Notifications need rate limits to stay encouraging without becoming noisy.
