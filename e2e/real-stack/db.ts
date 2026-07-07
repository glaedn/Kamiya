import { Client } from "pg";
import { expect } from "@playwright/test";
import { readRealStackState } from "./state";

export interface DatabaseReport {
  runId: string;
  actionCount: number;
  workflowCount: number;
  stepCount: number;
  projectCount: number;
  outcomeCount: number;
  taskCount: number;
  rootTaskCount: number;
  activeRootTaskCount: number;
  actionStatus?: string;
  workflowStatus?: string;
  attemptCount?: number;
  eventTypes: string[];
  projectId?: number;
  actionId?: string;
}

export async function databaseReportForRun(runId: string): Promise<DatabaseReport> {
  return withClient(async (client) => {
    const actions = await client.query(
      `SELECT *
       FROM api_actions
       WHERE intent_json->'arguments'->>'e2eRunId' = $1
       ORDER BY id ASC`,
      [runId]
    );
    const action = actions.rows[0];
    const workflows = action
      ? await client.query(`SELECT * FROM workflow_runs WHERE action_id = $1 ORDER BY created_at ASC`, [action.id])
      : { rows: [] };
    const workflow = workflows.rows[0];
    const projectId = action?.related_project_id ?? workflow?.related_project_id ?? null;
    const steps = workflow
      ? await client.query(`SELECT * FROM workflow_steps WHERE workflow_run_id = $1 ORDER BY created_at ASC`, [workflow.id])
      : { rows: [] };
    const projects = projectId
      ? await client.query(`SELECT * FROM projects WHERE id = $1`, [projectId])
      : { rows: [] };
    const outcomes = projectId
      ? await client.query(`SELECT * FROM outcomes WHERE project_id = $1`, [projectId])
      : { rows: [] };
    const tasks = projectId
      ? await client.query(`SELECT * FROM tasks WHERE project_id = $1 ORDER BY id ASC`, [projectId])
      : { rows: [] };
    const rootTasks = tasks.rows.filter((task) => !Array.isArray(task.dependencies) || task.dependencies.length === 0);
    const activeRootTasks = rootTasks.filter((task) => /^active|^urgent|^ready|^open/i.test(String(task.status)));
    const events = action
      ? await client.query(`SELECT event_type FROM api_action_events WHERE action_id = $1 ORDER BY created_at ASC`, [action.id])
      : { rows: [] };

    return {
      runId,
      actionCount: actions.rows.length,
      workflowCount: workflows.rows.length,
      stepCount: steps.rows.length,
      projectCount: projects.rows.length,
      outcomeCount: outcomes.rows.length,
      taskCount: tasks.rows.length,
      rootTaskCount: rootTasks.length,
      activeRootTaskCount: activeRootTasks.length,
      actionStatus: action?.status,
      workflowStatus: workflow?.status,
      attemptCount: workflow?.attempt_count == null ? undefined : Number(workflow.attempt_count),
      eventTypes: events.rows.map((row) => String(row.event_type)),
      projectId: projectId == null ? undefined : Number(projectId),
      actionId: action?.action_uuid ? String(action.action_uuid) : action?.id ? String(action.id) : undefined
    };
  });
}

export async function expectSuccessfulBootstrap(runId: string): Promise<DatabaseReport> {
  const report = await databaseReportForRun(runId);
  expect(report.actionCount, "one persisted action").toBe(1);
  expect(report.workflowCount, "one workflow").toBe(1);
  expect(report.projectCount, "one project").toBe(1);
  expect(report.outcomeCount, "one outcome").toBe(1);
  expect(report.taskCount, "tasks created").toBeGreaterThan(0);
  expect(report.rootTaskCount, "root tasks").toBeGreaterThanOrEqual(1);
  expect(report.activeRootTaskCount, "active root tasks").toBeGreaterThanOrEqual(1);
  expect(report.actionStatus).toBe("executed");
  expect(report.workflowStatus).toBe("completed");
  expect(report.eventTypes).toContain("workflow.completed");
  expect(report.eventTypes).toContain("action.executed");
  await expectGraphAcyclic(report.projectId);
  await expectNoSecretsForRun(runId);
  return report;
}

export async function expectRetryThenSuccess(runId: string): Promise<DatabaseReport> {
  const report = await expectSuccessfulBootstrap(runId);
  expect(report.attemptCount ?? 0).toBeGreaterThanOrEqual(2);
  expect(report.eventTypes).toContain("workflow.retry_scheduled");
  return report;
}

export async function expectBlockedBeforePersistence(runId: string): Promise<DatabaseReport> {
  const report = await databaseReportForRun(runId);
  expect(report.actionCount).toBe(1);
  expect(report.workflowCount).toBe(1);
  expect(report.workflowStatus).toBe("blocked");
  expect(report.projectCount).toBe(0);
  expect(report.outcomeCount).toBe(0);
  expect(report.taskCount).toBe(0);
  await expectNoSecretsForRun(runId);
  return report;
}

export async function expectCancelledBeforePersistence(runId: string): Promise<DatabaseReport> {
  const report = await databaseReportForRun(runId);
  expect(report.actionCount).toBe(1);
  expect(report.workflowCount).toBe(1);
  expect(report.actionStatus).toBe("cancelled");
  expect(report.workflowStatus).toBe("cancelled");
  expect(report.projectCount).toBe(0);
  expect(report.outcomeCount).toBe(0);
  expect(report.taskCount).toBe(0);
  await expectNoSecretsForRun(runId);
  return report;
}

export async function expectNoActionsForRun(runId: string): Promise<void> {
  const report = await databaseReportForRun(runId);
  expect(report.actionCount).toBe(0);
  expect(report.workflowCount).toBe(0);
  expect(report.projectCount).toBe(0);
  expect(report.taskCount).toBe(0);
}

async function expectGraphAcyclic(projectId?: number): Promise<void> {
  expect(projectId).toBeTruthy();
  await withClient(async (client) => {
    const result = await client.query(`SELECT id, dependencies FROM tasks WHERE project_id = $1 ORDER BY id ASC`, [projectId]);
    const ids = new Set(result.rows.map((row) => Number(row.id)));
    const visiting = new Set<number>();
    const visited = new Set<number>();
    const byId = new Map(result.rows.map((row) => [Number(row.id), (row.dependencies ?? []) as number[]]));

    for (const row of result.rows) {
      for (const dependency of row.dependencies ?? []) {
        expect(ids.has(Number(dependency))).toBe(true);
      }
    }

    function visit(id: number): boolean {
      if (visiting.has(id)) return false;
      if (visited.has(id)) return true;
      visiting.add(id);
      for (const dependency of byId.get(id) ?? []) {
        if (!visit(Number(dependency))) return false;
      }
      visiting.delete(id);
      visited.add(id);
      return true;
    }

    for (const id of ids) {
      expect(visit(id), `task dependency graph cycle at ${id}`).toBe(true);
    }
  });
}

async function expectNoSecretsForRun(runId: string): Promise<void> {
  await withClient(async (client) => {
    const result = await client.query(
      `SELECT
         COALESCE(jsonb_agg(a.intent_json || a.preview_payload || COALESCE(a.execution_result, '{}'::jsonb))::text, '') ||
         COALESCE(jsonb_agg(w.state || COALESCE(w.last_error, '{}'::jsonb))::text, '') ||
         COALESCE(jsonb_agg(e.payload)::text, '') AS haystack
       FROM api_actions a
       LEFT JOIN workflow_runs w ON w.action_id = a.id
       LEFT JOIN api_action_events e ON e.action_id = a.id
       WHERE a.intent_json->'arguments'->>'e2eRunId' = $1`,
      [runId]
    );
    const haystack = String(result.rows[0]?.haystack ?? "");
    expect(haystack).not.toContain("cerb_e2e_");
    expect(haystack).not.toContain("Authorization");
    expect(haystack).not.toContain("GEMINI_API_KEY");
  });
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const state = readRealStackState();
  const client = new Client({ connectionString: state.database.url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
