# Phase Review

## Phase 1 Review

Completed:

- Standalone Vite/React application.
- Local Kamiya API server.
- Chat interface with logged-out/logged-in copy.
- Slash command catalog and autocomplete.
- Intent router with Gemini Flash-Lite adapter and deterministic local fallback.
- Basic planning workflow with missing-field loop.
- Interactive cards.
- Action preview and confirmation queue.
- Cerbanimo API client boundary.
- Prompt and API contract documentation.

Folded forward from Phase 1:

- Autocomplete now exposes the full command catalog for `/`.
- Lint now ignores generated build output and parses TypeScript correctly.
- The logged-in/logged-out intro updates when auth mode changes.

## Phase 2 Started

Implemented:

- `/task` renders task-management cards through `CerbanimoClient.tasks`.
- `/community` and `/search` render result cards through the Cerbanimo search boundary.
- `/stats` renders platform-calculated stats cards.
- `/profile` renders profile summary cards.
- `/project` and `/open` render navigation target cards through `CerbanimoClient.renderPage`.
- Notification/approval card support is wired in the API layer for the upcoming notifications surface.

Still platform-dependent:

- Real OAuth/OIDC authentication.
- Cerbanimo `/search`, `/profile/me`, `/profile/stats`, `/render/page`, and `/automation/actions` formal endpoints.
- True approval notification delivery and channel fanout.
- Full task claim/drop/review actions as confirmed mutations.

## Phase 3 Started

Implemented:

- Automation workflow classification for research, document summaries, project-plan generation, GitHub issues, pull requests, staging deploys, deadline monitoring, blockers, reminders, submission validation, PR review, quality checks, and custom workflows.
- `/automation` template browsing.
- `/automation queue`, `/automation status`, and `/automation history` action queue rendering.
- Confirmed automation previews now create local action-history records and return action queue cards.
- Validation report card support through `CerbanimoClient.validationReport`.
- Phase 3 API contracts documented in `docs/api-contract.md` and `docs/cerbanimo-platform-requirements.md`.

Still platform-dependent:

- Real workflow workers.
- GitHub integration authorization and repository selection.
- Document ingestion/storage.
- Deployment provider wiring.
- Persistent Action object storage and notification fanout.

## Phase 4 Started

Implemented:

- Agent mode contracts and `/mode` command.
- Mode card and right-rail mode switch.
- Channel-neutral message contracts.
- Discord, Slack, and Google Chat adapter endpoint scaffolds.
- Public TypeScript SDK scaffold.
- Integration overview card.
- Cerbanimo implementation plan in `docs/cerbanimo-implementation-plan.md`.

Still platform-dependent:

- Bot installation and signing verification.
- External identity linking.
- Voice interface.
- Scheduled/background agent execution.
- Public SDK packaging and publishing.
