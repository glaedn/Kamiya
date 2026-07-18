# Kamiya

Kamiya is a standalone conversational project management and automation assistant for Cerbanimo.

Cerbanimo stores projects, tasks, communities, rewards, memory, statistics, and automation state. Kamiya interprets user intent, asks for missing information, previews actions, and executes only through Cerbanimo APIs.

## Phase 1 Surface

- React chat page with logged-out and logged-in introductions.
- Slash command autocomplete for `/plan`, `/create`, `/project`, `/task`, `/submit`, `/community`, `/search`, `/profile`, `/stats`, `/open`, `/help`, `/automation`, and `/settings`.
- Model-independent intent routing with a Gemini Flash-Lite adapter.
- Planning loop that asks only for missing project fields.
- Action preview and confirmation queue for modifying actions.
- Interactive response cards for projects, tasks, search, statistics, and approvals.
- Cerbanimo API client boundary with mock-safe development behavior.

## Golden Conversation v1

Kamiya's project-creation golden path uses Cerbanimo's durable `/api/v1/actions` contract:

```text
POST /api/v1/actions/preview
POST /api/v1/actions/:id/confirm
GET  /api/v1/actions/:id
POST /api/v1/actions/:id/cancel
POST /api/v1/actions/:id/retry
GET  /api/v1/actions
```

The canonical function is `projects.bootstrap`. Kamiya owns the conversation, preview rendering, explicit confirmation, progress polling, refresh recovery, and result cards. Cerbanimo owns the persisted action, workflow, project plan generation, task graph validation, project/task persistence, activation, retries, and audit history.

Golden Conversation v1 now passes both profiles:

- Deterministic contract profile: local stateful Cerbanimo fixture, desktop/mobile browser checks, no production services.
- Isolated real-stack profile: real Kamiya React app, real Kamiya Express API, real Cerbanimo `/api/v1`, isolated PostgreSQL database, real pg-boss worker, deterministic provider at the external generation seam only.

The older direct project creation plus `/projects/auto-generate` sequence is deprecated for Kamiya's golden project flow.

## Task Automation Classification

Kamiya now renders Cerbanimo's durable task automation eligibility metadata on active task cards:

- `human_driven`: human judgment, participation, or physical action is required.
- `assisted_automation`: Kamiya can help after required inputs or approvals are supplied.
- `fully_automatable`: the task is bounded digital work with capability and artifact requirements, but execution is not enabled yet.

This classification is informative only. It does not authorize execution, prove capability availability, or replace user confirmation. See `docs/task-automation-classification.md`.

## Task Automation Preparation And Quality Checks

Kamiya can now ask Cerbanimo for task automation context, save actor-owned preparation drafts, render capability blocker reasons, create a durable `tasks.run_automation` action preview, and confirm the first bounded automation capability: `github.run_quality_checks`.

The quality-check path runs only through Cerbanimo's guarded executor contract. The deterministic executor is for E2E mode only; production remains blocked with `PRODUCTION_SANDBOX_REQUIRED` until a real sandbox provider is configured. Passing quality checks submit the task for review without awarding rewards or marking completion.

See `docs/task-automation-preparation.md` and `docs/run-quality-checks-automation.md`.

## Game Master Mode

Kamiya now supports Game Master Mode as a presentation layer over Cerbanimo project state. Users can switch narration on/off, set intensity, open quest context, assemble parties, manage callings, preview quest launches, and view chronicles through `/api/v1` Game Master endpoints.

Game Master Mode never owns project truth and never claims completion, rewards, dependency activation, or story publication. Saved chat history redacts one-time invite tokens before storing conversations in Cerbanimo.

See `docs/game-master-mode.md`.

## Quick Start

```bash
npm install
npm run dev
```

The web app runs at `http://localhost:5173`. The local Kamiya API runs at `http://localhost:4177`.

Set `KAMIYA_GEMINI_API_KEY` for live Gemini routing. Without it, Kamiya uses a deterministic local router so the app can still be developed and tested.

## Environment

Copy `.env.example` to `.env` and configure:

- `KAMIYA_GEMINI_API_KEY`: server-side Gemini API key.
- `KAMIYA_GEMINI_MODEL`: defaults to `gemini-3.1-flash-lite`.
- `KAMIYA_CERBANIMO_API_URL`: default Cerbanimo API base URL.
- `KAMIYA_CERBANIMO_BEARER_TOKEN`: server-side Cerbanimo bearer token. This is never entered in the browser.
- `VITE_CERBANIMO_ORIGIN`: Cerbanimo frontend origin that hosts `/auth/bridge/start`.
- `VITE_CERBANIMO_API_BASE`: Cerbanimo API base used for user-scoped Auth0 token calls.
- `KAMIYA_ALLOWED_ORIGIN`: comma-separated web client origins for CORS. Local defaults include Kamiya on `http://localhost:5173` and Resonera on `http://localhost:3000`.
- `KAMIYA_CERBANIMO_TIMEOUT_MS`: optional server-side timeout for Cerbanimo API requests.
- `KAMIYA_DEFAULT_QUALITY_CHECK_REPOSITORY`: optional `owner/repository` default for the Packet 006 quality-check flow.
- `KAMIYA_DEFAULT_QUALITY_CHECK_REF`: optional default ref for quality checks.

For popup login, Cerbanimo must allow Kamiya's browser origin in its auth bridge settings and Auth0 callback settings. See `docs/cerbanimo-platform-requirements.md` for the platform-side work.

## Architecture

```text
Web / Discord / Slack
  -> Kamiya API
  -> Intent Router
  -> Action Planner
  -> Action Queue
  -> Cerbanimo API
```

Kamiya does not own Cerbanimo business logic. It owns conversation state, prompt orchestration, previews, confirmations, and client-specific rendering.

See `docs/cerbanimo-platform-requirements.md` for the Cerbanimo APIs and core platform features needed next.

## Browser Tests

```bash
npm run test:e2e:contract
npm run test:e2e:integration
npm run test:e2e:failure
npm run test:e2e
npm run test:e2e:headed
```

The contract suite starts a local stateful Cerbanimo fixture and never contacts production hosts. The real-stack suites start a Windows-compatible local process group through `e2e/real-stack/start-real-stack.ts`.

Real-stack safety rules:

- The launcher creates a unique PostgreSQL database whose name contains `e2e`.
- Database drop/create refuses targets without `e2e` or `test`, and refuses production-like names.
- Cerbanimo deterministic bootstrap mode refuses startup unless `NODE_ENV=test`, `CERBANIMO_E2E_MODE=true`, and the database target contains `e2e` or `test`.
- The launcher clears live Gemini keys for the test process and uses scoped E2E API tokens only.
- The integration DB verifier asserts the generated task mix includes one `human_driven`, one `assisted_automation`, and one `fully_automatable` task.
- Real-stack artifacts are written under `artifacts/golden-conversation/`, `playwright-report-real-stack/`, and `test-results-real-stack/`; those paths are gitignored.
