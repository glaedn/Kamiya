# Core World v1 integration audit

Audit date: 2026-07-17. This document distinguishes working behavior from product language and future direction. Cerbanimo remains the only authority for completion, rewards, XP, dependency activation, project completion, and shared domain events.

## Scope matrix

| Area | Audited state | Evidence and boundary |
|---|---|---|
| Task settlement | Functional | One accepted review is locked and settled in one PostgreSQL transaction. Completion, contributor/reviewer rewards, XP, dependency activation, project completion, chronicle, outbox, and acceptance state are replay-safe. |
| Kamiya settlement guidance | Functional | Kamiya previews or reads settlement state through the versioned API and renders server-authored status/reward cards. It cannot mint effects. |
| Resonera world | Functional vertical slice | A real Cerbanimo project, task graph, event cursor, balance, skills, chronicle, review state, and settlement are rendered in web/Expo UI. The atlas is a static atmosphere image with data-driven task/dependency nodes, not a generated community geography engine. |
| Evidence | Partial | Resonera can draft summary/reflection, submit text, and ask Cerbanimo to snapshot a URL. Cerbanimo supports broader evidence types, but Resonera has no photo/file upload flow yet. |
| Offline behavior | Partial | Resonera caches world JSON, cursor, and evidence drafts in its current storage adapter. Cached reads survive a web reload; authoritative submissions and rewards fail closed offline. Native SQLite queue/replay is not implemented. |
| Encounter modes | Metadata/prototype | `off`, `private`, `split_party`, and `shared_party` are stored as evidence encounter context and affect UI copy. They do not create private rooms, group membership, live presence, or reward-splitting channels. |
| Party | Backend subset | Cerbanimo has party roster, calling, invite, and project policy APIs. Resonera does not yet provide live multiplayer communication, presence, leader election, or party-management screens. |
| Lead contributor | Policy subset | Settlement supports an explicit leader ID and deterministic weighted allocation when trusted policy contains it. There is no complete nomination/consent UI or membership enforcement flow across clients. |
| Shared communication | Not implemented | Domain events are shared durable facts. Kamiya conversations are per request/chat; there is no shared real-time NPC conversation, group chat, or split-party channel. |
| NPC encounter | Presentation only | Kamiya can guide evidence/review/settlement from Resonera's Whisper console. There is no avatar rig, combat state machine, quiz encounter, LLM-validated skill quiz, stat advantage, or audio performance. |
| Community venues | Vocabulary/flags only | Welcome Center, Library, Town Hall, Federation HQ, Dungeon Chain, and Market are documented names. There are no venue screens or venue-specific contracts in this slice. |
| Community regions/market/dungeons | Disabled future flags | Flags exist as runway only. No regional map aggregation, `<Community Name> Coin` exchange, escrow, outside-helper market, or chained-dungeon game loop ships here. |
| Avatars and high-fantasy animation | Unimplemented | Package candidates are documented for later evaluation; no third-party avatar runtime or reusable NPC creator was added. |
| Android | Source/export only until device gate | Expo can export an Android JS bundle. A real Gradle APK, emulator install, device launch, permissions, back behavior, keyboard, TalkBack, and performance must be reported separately after the native gate. |

## Contract and authority boundary

- Contract identity is `1.0.0` plus `sha256:a9c1c50e5c5af8304e750ca326d72b89136f1a9356456499bff5583f78bba55b`.
- Cerbanimo adds both values to every `/api/v1` response and exposes `/api/v1/contract` before authentication.
- Kamiya and Resonera reject missing, stale, or incompatible response identity with `CONTRACT_INCOMPATIBLE` before parsing the payload.
- Checked-in consumer snapshots are compared with the canonical package in CI/local verification; schema-name, version, or digest drift fails the gate.
- The clients never infer authoritative reward, XP, completion, or dependency effects from animation or model prose.

## Integration assertions

The real-stack suite uses an isolated PostgreSQL database, real Cerbanimo and Kamiya servers, a production Resonera web export, deterministic external providers, and three separately scoped actors. It asserts:

1. an accepted private-project task settles once under concurrent/replayed requests;
2. one completion, five reward rows, one XP row, four ordered domain events, four delivered outbox rows, and exact contributor/peer/PM allocations;
3. reward conservation (40 contributor + three 10 peer + one 10 PM = 80) and contributor XP of 40;
4. dependent tasks activate and a non-final project remains active; the final-task scenario completes the project;
5. event cursors are ordered, unique, and empty when replayed after the last cursor;
6. an unrelated scoped actor receives 403 for world state, settlement, evidence, and event history;
7. Kamiya and Resonera show the same committed result;
8. Resonera reloads the cached world as `OFFLINE CHRONICLE` when the live world endpoint is disconnected.

This is a real local integration test, but external AI and quality-check providers remain deterministic. It is not a production identity, network, multiplayer, or Android-device test.

## Security audit

- Settlement services repeat task authorization internally; route middleware is not the only boundary. Unrelated actors are integration-tested against private project data.
- Reward/XP inputs must be safe integers between 0 and 1,000,000; malformed modes, weights, token types, and participant IDs block settlement. PostgreSQL constraints backstop application checks.
- URL evidence uses DNS/IP checks, redirect revalidation, private/reserved address denial, size/type inspection, HTML sanitization, image re-encoding, and canonical digests in Cerbanimo.
- CORS is allowlist-based in Cerbanimo and Kamiya. Contract and request headers are explicitly exposed to browser consumers.
- Kamiya forwards a user token only to a validated loopback development endpoint or an operator-allowlisted HTTPS Cerbanimo origin. A caller cannot select an arbitrary token destination.
- One-time invite secrets are redacted before saved chat history. Request bodies and bearer values are not written to the real-stack logs; generated logs are redacted.
- Resonera refuses an `EXPO_PUBLIC` static Cerbanimo token in production unless an explicit disposable E2E opt-in is set. `EXPO_PUBLIC` values are never a production secret mechanism.

Remaining production blockers: Kamiya's HTTP API still needs deployment-level user authentication and rate limiting; Resonera needs a real login/session exchange and platform secure storage; live chat/presence needs its own authorization model; evidence retention/deletion and telemetry policies require governance review.

## Test inventory correction

The Cerbanimo default runner now owns two explicit inventories: frontend tests under `src/**` and backend tests under `backend/**`. Six maintained UI suites were migrated to current behavior. Two backend schema tests are no longer mis-collected by the frontend runner. A Linux-path, screenshot-only Playwright file with no assertions was retired. The schema smoke runner creates and destroys a uniquely named test schema and refuses unsafe names instead of resetting a developer database.

The final release report must record exact commands, counts, commit SHAs, integration artifacts, native Android outcome, and any remaining failures; an Expo export alone must not be reported as Android validation.
