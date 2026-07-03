# Task Automation Classification

Packet 004 adds durable task automation eligibility metadata owned by Cerbanimo and rendered by Kamiya.

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

## Kamiya Rendering

Kamiya parses the canonical automation object with safe fallback. Missing or malformed metadata renders as:

```text
Human task
This task predates automation classification and defaults to human execution.
```

Task cards display the classification label, explanation, required inputs, capability requirements, expected artifacts, validation summary, skill, reward, due date, and dependencies.

Kamiya may show `View required inputs` for assisted tasks. It does not render an enabled `Automate` button in Packet 004. Fully automatable tasks say that execution capability is not connected yet.

## Deterministic Golden Mix

The deterministic project bootstrap provider returns:

- `Map governance requirements` as `human_driven`;
- `Prototype constitution voting` as `assisted_automation`;
- `Run baseline repository quality checks` as `fully_automatable`.

Browser and database verification assert the 1/1/1 classification mix, assisted required inputs, fully automatable capability/artifact metadata, and no fake automation execution control.

## Known Limitations

- Assisted input collection is read-only.
- Task automation execution is not implemented.
- Capability availability and authorization are not resolved per task.
- Validation workers do not yet evaluate task artifacts.

## Next Packet

Packet 005 should implement Assisted Automation Input Contracts and Preparation Flow. It should turn `required_human_inputs` into a secure form and produce a reviewable action preview without executing arbitrary work.
