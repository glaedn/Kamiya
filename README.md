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

Kamiya's project-creation golden path now uses Cerbanimo's durable `/api/v1/actions` contract:

```text
POST /api/v1/actions/preview
POST /api/v1/actions/:id/confirm
GET  /api/v1/actions/:id
POST /api/v1/actions/:id/cancel
POST /api/v1/actions/:id/retry
GET  /api/v1/actions
```

The canonical function is `projects.bootstrap`. Kamiya owns the conversation, preview rendering, explicit confirmation, progress polling, refresh recovery, and result cards. Cerbanimo owns the persisted action, workflow, project plan generation, task graph validation, project/task persistence, activation, retries, and audit history.

The older direct project creation plus `/projects/auto-generate` sequence is deprecated for Kamiya's golden project flow.

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
- `KAMIYA_ALLOWED_ORIGIN`: web client origin for CORS.
- `KAMIYA_CERBANIMO_TIMEOUT_MS`: optional server-side timeout for Cerbanimo API requests.

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
npm run test:e2e:headed -- --grep "golden conversation"
```

The contract suite starts a local stateful Cerbanimo fixture and never contacts production hosts. In PowerShell, if npm drops the `--grep` option, use `npm run test:e2e:headed -- "--grep=golden conversation"` or `npx playwright test --headed --project=chromium --grep="golden conversation"`.

Real-stack integration is gated behind `KAMIYA_REAL_STACK_E2E=1` and requires an isolated Cerbanimo database/schema containing `e2e` or `test` plus a deterministic project-bootstrap provider.
