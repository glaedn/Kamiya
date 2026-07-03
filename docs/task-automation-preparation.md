# Task Automation Preparation

Kamiya treats Cerbanimo as the source of truth for task automation preparation.
Client state can help resume a conversation, but it never authorizes execution.

## Lifecycle

1. Kamiya asks Cerbanimo for `GET /api/v1/tasks/:taskId/automation`.
2. Cerbanimo returns task automation metadata, required input schema, capability resolution, and any active actor-owned preparation.
3. Kamiya renders `Prepare with Kamiya` or `Review quality checks` only from that server response.
4. Preparation input is saved through `POST /api/v1/tasks/:taskId/automation/preparations`.
5. Cerbanimo snapshots the input schema, validates values, stores sanitized input values, and resolves capability availability.
6. A ready preparation can create one durable preview through `POST /api/v1/tasks/:taskId/automation/preparations/:id/preview`.
7. Execution still requires confirming the returned Cerbanimo action.

Canonical statuses are `draft`, `invalid`, `ready`, `previewed`, `consumed`, and `cancelled`.

## Input Schema

Supported input types are `text`, `long_text`, `number`, `boolean`, `date`, `url`, `repository`, `file`, `choice`, `secret_reference`, and `approval`.

Kamiya must display labels, descriptions, required state, and server errors. Cerbanimo validates required values, type, length, numeric bounds, dates, URL protocols, repository identifiers, choices, file ownership, secret-reference ownership, explicit approval, unknown keys, and duplicate schema keys.

Sensitive raw values are rejected unless a future encrypted-at-rest facility is explicitly implemented. For secrets, Kamiya should send only `secret_reference` identifiers and must never render secret values back to the user.

## Capability Truth

Classification is not execution permission.

Cerbanimo capability resolution returns:

- required capabilities;
- available capabilities;
- missing capabilities;
- actor authorization;
- execution availability;
- truthful blocker reasons such as `CAPABILITY_NOT_REGISTERED`, `EXECUTOR_NOT_CONFIGURED`, `ACTOR_SCOPE_MISSING`, `INPUTS_INCOMPLETE`, `TASK_POLICY_BLOCKED`, or `PRODUCTION_SANDBOX_REQUIRED`.

Kamiya may save and resume a preparation when capability is unavailable, but it must not offer fake execution controls.

