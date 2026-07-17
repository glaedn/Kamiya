# Core world integration

Kamiya is the conversational guide for the Cerbanimo/Resonera loop. It does not calculate rewards, complete tasks, unlock dependencies, or own project state.

## Guided turn-in and review

Evidence cards now expose an accessible turn-in desk for text reports and URL artifacts. These controls emit the existing audited Kamiya commands, which call Cerbanimo's evidence-bundle API. The submission preview still freezes the manifest and confirmation remains a separate action.

Review assignment cards expose rationale and decision controls only when Cerbanimo returns the corresponding allowed action. Raw frozen evidence remains hidden until the assignment is accepted. Requests for changes, rejection, and recusal require a reason in the guided UI.

## Completion settlement

After validation, peer Blessings, and the PM Ritual Seal accept a task, Kamiya reads or queues the Cerbanimo settlement. Progress, blocked-policy errors, retry/cancel actions, contributor/reviewer ledger events, skill XP, dependency activation, project completion, and the Chronicle beat render from the durable settlement response. Repeated status requests never apply local effects.

## Cross-client contract

`shared/generated/cerbanimo-contract.json` pins `@cerbanimo/api-contract` version 1.0.0 and the required schema set. `npm run contract:verify` compares it to a local Cerbanimo checkout when `CERBANIMO_REPO` is set and fails on drift.

## Combined acceptance

The real-stack settlement fixture races worker claims and asserts one completion, reward/XP ledger set, dependency activation set, narrative event set, and delivered outbox set. The browser journey proves pending, success, blocked missing-policy, reload recovery, and plain-language rendering.
