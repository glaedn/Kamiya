# Phase 4 Notes

Implemented in Kamiya:

- Agent mode contract: Auto, Planner, Builder, Reviewer, Automator, Manager, Coach.
- `/mode` command and mode cards.
- Channel-neutral inbound/outbound message contracts.
- Webhook endpoint scaffolds:
  - `POST /api/adapters/discord`
  - `POST /api/adapters/slack`
  - `POST /api/adapters/google-chat`
- Public TypeScript SDK scaffold in `shared/sdk.ts`.
- Integration overview card surfaced through `/help`.
- Right-rail mode switch in the web app.

Still intentionally platform-dependent:

- Real Discord/Slack/Google Chat signing verification.
- Bot token installation flows.
- User identity linking.
- Voice capture/transcription/playback.
- Scheduled automation execution.
- Background agent workers.
- SDK packaging and publishing.

The adapter endpoints normalize incoming channel payloads into the same `ChatTurnRequest` used by the web app. This keeps all business behavior centralized in Kamiya and Cerbanimo APIs rather than duplicated per chat client.
