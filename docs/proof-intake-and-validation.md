# Proof Intake And Validation

Kamiya treats task submission as Cerbanimo-owned evidence validation.

The chat client can:

- show evidence requirements with `GET /api/v1/tasks/:taskId/evidence`;
- create or recover a draft evidence bundle;
- save bounded text evidence or URL snapshot evidence;
- preview a `tasks.submit_evidence` action;
- confirm the action through `/api/v1/actions/:id/confirm`;
- render the resulting `submission_validation` run.

Kamiya does not submit directly to legacy task routes and does not calculate validation results locally.

## Chat Commands

- `submit evidence <taskId>`
- `add evidence <taskId> <text>`
- `add url evidence <taskId> https://example.com/proof`
- `evidence requirements <taskId>`
- `preview evidence <taskId>`

Buttons on evidence cards use the same command strings so Discord, Slack, and future clients can map the flow without duplicating business logic.

## Result Semantics

- `validation_passed`: Cerbanimo moved the task into review.
- `needs_more_evidence`: the bundle remains auditable and the user should add more proof.
- `manual_review_required`: Cerbanimo created a manual validation review.
- `validation_failed`: the bundle failed deterministic validation.

Kamiya renders these states but Cerbanimo owns all task state mutations.
