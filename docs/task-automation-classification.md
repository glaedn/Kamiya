# Task Automation Classification And Preparation

Packets 004-006 add durable task automation eligibility metadata, actor-owned preparations, and the first executable quality-check automation. Cerbanimo owns the policy, storage, execution, and audit trail. Kamiya renders the state and routes user confirmation.

## Canonical Values

- `human_driven`: the task needs a person's judgment, participation, accountability, consent, relationship, or physical action.
- `assisted_automation`: automation can help after a person supplies required inputs, grants bounded authorization, or reviews before external effects.
- `fully_automatable`: the task is bounded digital work with no missing human inputs, at least one capability requirement, and at least one expected artifact.

Classification is eligibility only. It never grants capability availability, actor authorization, confirmation, execution, or validation permission.

## Cerbanimo Storage

Cerbanimo stores these fields on `tasks`:

- `automation_classification`
- `automation_confidence`
- `automation_rationale`
- `required_human_inputs`
- `automation_requirements`
- `validation_requirements`
- `automation_policy_findings`
- `classification_source`
- `classification_version`
- `classified_at`

Existing and legacy tasks fail closed to `human_driven` with `classification_source = legacy_default`. Manual task creation fails closed to `human_driven` unless a future authorized review flow supplies valid metadata.

## Metadata Shape

Required human inputs are an array of `{ key, label, description, inputType, required, sensitive }`. Allowed input types are `text`, `long_text`, `number`, `boolean`, `date`, `url`, `repository`, `file`, `choice`, `secret_reference`, and `approval`.

Automation requirements are an object with optional `capabilities`, `tools`, `externalServices`, `permissions`, `expectedArtifacts`, `estimatedDurationMinutes`, and `networkAccess`. `networkAccess` is `none`, `restricted`, or `required`.

Validation requirements are an array of `{ requirementId, description, proofTypes, checks }`.

## Safety Downgrades

Cerbanimo normalizes generated metadata before persistence. Local or physical work, direct interpersonal care, binding governance decisions, conflict mediation, legal/medical/safety-critical judgment, financial commitments, destructive actions, unspecified credentials, and external publication without approval cannot become `fully_automatable` by model assertion.

Contradictory metadata fails closed:

- fully automatable with human inputs becomes `assisted_automation`;
- fully automatable without capability or artifact metadata becomes `human_driven`;
- assisted automation without required inputs becomes `human_driven`;
- unknown categories become `human_driven`;
- human-driven tasks strip misleading execution capability claims.

## API Shape

Canonical `/api/v1` task payloads expose:

```json
{
  "id": 123,
  "name": "Run baseline repository quality checks",
  "automation": {
    "classification": "fully_automatable",
    "confidenceBand": "high",
    "rationale": "The task is bounded digital work with a known capability and expected quality-check report.",
    "requiredHumanInputs": [],
    "requirements": {
      "capabilities": ["github.run_quality_checks"],
      "expectedArtifacts": ["quality-check-report"],
      "networkAccess": "restricted"
    },
    "validationRequirements": [],
    "source": "generated",
    "version": "task-automation-v1",
    "classifiedAt": "2026-07-03T00:00:00.000Z",
    "findings": []
  }
}
```

`GET /api/v1/actions/:id` includes the same `automation` object on `tasks` and `activeTasks`.

Task automation preparation uses these Cerbanimo APIs:

- `GET /api/v1/tasks/:taskId/automation`
- `POST /api/v1/tasks/:taskId/automation/preparations`
- `PATCH /api/v1/tasks/:taskId/automation/preparations/:preparationId`
- `POST /api/v1/tasks/:taskId/automation/preparations/:preparationId/validate`
- `POST /api/v1/tasks/:taskId/automation/preparations/:preparationId/preview`
- `POST /api/v1/tasks/:taskId/automation/preparations/:preparationId/cancel`
- `GET /api/v1/automation/runs/:id`

Preparation statuses are `draft`, `invalid`, `ready`, `previewed`, `consumed`, and `cancelled`. Modifying work still flows through action preview, user confirmation, `automation_runs`, and `automation_logs`.

## Kamiya Rendering

Kamiya parses the canonical automation object with safe fallback. Missing or malformed metadata renders as:

```text
Human task
This task predates automation classification and defaults to human execution.
```

Task cards display the classification label, explanation, required inputs, capability requirements, expected artifacts, validation summary, skill, reward, due date, and dependencies.

Kamiya shows `Prepare with Kamiya` for assisted tasks and `Review quality checks` for tasks requiring `github.run_quality_checks`. Assisted preparation can be saved without execution when Cerbanimo reports `CAPABILITY_NOT_REGISTERED`, `EXECUTOR_NOT_CONFIGURED`, `ACTOR_SCOPE_MISSING`, `INPUTS_INCOMPLETE`, `TASK_POLICY_BLOCKED`, or `PRODUCTION_SANDBOX_REQUIRED`.

Quality-check execution is confirmation gated. On `checks_passed`, Cerbanimo attaches the report URI and moves the task to `submitted`. It does not award rewards, approve completion, merge code, push code, or deploy anything.

## Deterministic Golden Mix

The deterministic project bootstrap provider returns:

- `Map governance requirements` as `human_driven`;
- `Prototype constitution voting` as `assisted_automation`;
- `Run baseline repository quality checks` as `fully_automatable`.

Browser and database verification assert the 1/1/1 classification mix, assisted required inputs, fully automatable capability/artifact metadata, and no fake automation execution control.

## Known Limitations

- The only executable task capability is guarded `github.run_quality_checks`.
- Production quality checks remain unavailable until a real sandbox executor is configured.
- Assisted pull-request generation remains preparation-only.
- Validation workers do not yet evaluate arbitrary task artifacts.

## Next Packet

Next packets should replace the default quality-check repository convenience with full form editing, add a production sandbox executor, and expand capability implementations beyond quality checks.
