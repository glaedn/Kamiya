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
- `KAMIYA_ALLOWED_ORIGIN`: web client origin for CORS.

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
