# Run Quality Checks Automation

`github.run_quality_checks` is the first executable task automation capability in the Kamiya/Cerbanimo integration.

## Contract

Kamiya prepares a task-owned automation through Cerbanimo. The action preview uses `tasks.run_automation` and stores only durable identifiers in the action intent:

```json
{
  "functionName": "tasks.run_automation",
  "arguments": {
    "taskId": 123,
    "preparationId": 456,
    "capabilityName": "github.run_quality_checks"
  }
}
```

The preparation record stores sanitized inputs:

```json
{
  "repository": "owner/name",
  "ref": "main",
  "checkProfile": "node_standard",
  "approval": true
}
```

Raw command strings are not accepted.

## Execution Boundary

Cerbanimo owns execution through `automation_runs`, `automation_logs`, and the pg-boss `automation-execution` queue.

The deterministic executor is available only in protected E2E mode:

- `NODE_ENV=test`;
- `CERBANIMO_E2E_MODE=true`;
- database name contains `e2e` or `test`;
- database target is not production-like.

Production remains unavailable until a real sandbox executor exists. The capability must return `PRODUCTION_SANDBOX_REQUIRED` rather than running repository code inside the API process.

## Result Mapping

Canonical result statuses are `checks_passed`, `checks_failed`, `blocked`, `cancelled`, and `executor_failed`.

`checks_passed` attaches a report URI to the task, marks the task `submitted`, and waits for normal Cerbanimo review. It does not award XP/tokens or mark the task complete.

`checks_failed` is a completed automation report, not a worker crash. The task is not submitted as successful work.

Kamiya confirms the durable action, hydrates the automation run once, and renders Cerbanimo's current run state truthfully. Queued and running states stay visible as queued/running cards; retry controls appear only when Cerbanimo reports blocked, failed, or retry-wait state.
