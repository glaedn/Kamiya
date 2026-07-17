import crypto from "node:crypto";
import { Client } from "pg";
import { expect } from "@playwright/test";
import { readRealStackState } from "./state";

interface SettlementSeedOptions {
  missingRewardPolicy?: boolean;
  finalProjectTask?: boolean;
}

export interface SettlementSeed {
  key: string;
  projectId: number;
  taskId: number;
  dependentTaskIds: number[];
  contributorId: number;
  peerIds: number[];
  pmId: number;
}

export async function seedAcceptedSettlement(options: SettlementSeedOptions = {}): Promise<SettlementSeed> {
  const state = readRealStackState();
  const key = `settlement_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const client = new Client({ connectionString: state.database.url });
  await client.connect();
  try {
    await client.query("BEGIN");
    const peerIds: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      const peer = (await client.query(
        `INSERT INTO users (auth0_id, username, email, roles, skills, interests)
         VALUES ($1, $2, $3, '{user}'::text[], '[]'::jsonb, '[]'::jsonb)
         RETURNING id`,
        [`auth0|${key}-peer-${index}`, `${key}_peer_${index}`.slice(0, 50), `${key}-peer-${index}@example.test`]
      )).rows[0];
      peerIds.push(Number(peer.id));
    }

    const project = (await client.query(
      `INSERT INTO projects (name, description, creator_id, status, settlement_policy)
       VALUES ($1, 'Packet 009 real-stack settlement fixture.', $2, 'active', '{}'::jsonb)
       RETURNING id`,
      [`Settlement Quest ${key}`, state.actors.b.id]
    )).rows[0];
    const skill = (await client.query(
      `INSERT INTO skills (name, description) VALUES ($1, 'Real-stack settlement progression fixture.') RETURNING id`,
      [`Settlement Skill ${key}`]
    )).rows[0];
    const task = (await client.query(
      `INSERT INTO tasks (
         name, description, project_id, creator_id, skill_id, status,
         assigned_user_ids, reward_tokens, submitted, submitted_at,
         submitted_by, dependencies, settlement_policy
       )
       VALUES ($1, 'Accepted contribution awaiting canonical settlement.', $2, $3, $4,
         'submitted', ARRAY[$5]::integer[], $6, TRUE, NOW(), $5, '{}'::integer[], '{}'::jsonb)
       RETURNING id`,
      [
        options.finalProjectTask ? "Complete the final settlement encounter" : "Ship the accepted settlement slice",
        project.id,
        state.actors.b.id,
        skill.id,
        state.actors.a.id,
        options.missingRewardPolicy ? null : 40
      ]
    )).rows[0];

    const dependentTaskIds: number[] = [];
    if (!options.finalProjectTask) {
      for (const name of ["Open the verified pilot", "Begin the governance rehearsal"]) {
        const dependent = (await client.query(
          `INSERT INTO tasks (
             name, description, project_id, creator_id, status, dependencies,
             assigned_user_ids, reward_tokens
           )
           VALUES ($1, 'Begins only after every prerequisite is completed.', $2, $3,
             'inactive-unassigned', ARRAY[$4]::integer[], '{}'::integer[], 0)
           RETURNING id`,
          [name, project.id, state.actors.b.id, task.id]
        )).rows[0];
        dependentTaskIds.push(Number(dependent.id));
      }
    }

    const manifestHash = crypto.createHash("sha256").update(`${key}:${task.id}`).digest("hex");
    const bundle = (await client.query(
      `INSERT INTO task_evidence_bundles (
         task_id, actor_user_id, source_kind, status, version, reflection,
         requirement_snapshot, validation_policy_snapshot, frozen_manifest,
         manifest_sha256, frozen_at, submitted_at, validated_at
       )
       VALUES ($1, $2, 'human', 'validation_passed', 1, 'Accepted fixture evidence.',
         '[]'::jsonb, '{}'::jsonb, $3::jsonb, $4, NOW(), NOW(), NOW())
       RETURNING id`,
      [task.id, state.actors.a.id, JSON.stringify({ manifestVersion: "evidence-manifest-v2", manifestSha256: manifestHash }), manifestHash]
    )).rows[0];
    const validation = (await client.query(
      `INSERT INTO task_validation_results (
         bundle_id, task_id, provider, status, overall_verdict,
         requirement_results, summary, metadata
       )
       VALUES ($1, $2, 'deterministic', 'passed', 'passed', '[]'::jsonb,
         'Deterministic fixture validation passed.', '{}'::jsonb)
       RETURNING id`,
      [bundle.id, task.id]
    )).rows[0];
    const reviewPolicy = {
      policyVersion: "task-review-v1",
      peerApprovalsRequired: 3,
      peerReviewerRewardAmount: 10,
      pmReviewerRewardAmount: 10
    };
    const round = (await client.query(
      `INSERT INTO task_review_rounds (
         task_id, bundle_id, validation_result_id, submission_actor_user_id,
         status, stage, risk_tier, policy_version, policy_snapshot,
         evidence_manifest_sha256, peer_approvals_required,
         peer_approvals_received, peer_gate_satisfied_at, peer_gate_method,
         pm_gate_satisfied_at, pm_gate_method, accepted_at
       )
       VALUES ($1, $2, $3, $4, 'accepted_pending_settlement', 'accepted',
         'standard', 'task-review-v1', $5::jsonb, $6, 3, 3, NOW(), 'human',
         NOW(), 'human', NOW())
       RETURNING id`,
      [task.id, bundle.id, validation.id, state.actors.a.id, JSON.stringify(reviewPolicy), manifestHash]
    )).rows[0];

    for (const reviewerId of peerIds) {
      const assignment = (await client.query(
        `INSERT INTO task_review_assignments (
           review_round_id, reviewer_user_id, reviewer_role, status,
           accepted_at, conflict_snapshot, eligibility_snapshot
         )
         VALUES ($1, $2, 'peer_reviewer', 'completed', NOW(), '{}'::jsonb, '{}'::jsonb)
         RETURNING id`,
        [round.id, reviewerId]
      )).rows[0];
      await client.query(
        `INSERT INTO task_review_decisions (
           review_round_id, assignment_id, reviewer_user_id, decision, reason,
           requirement_findings, evidence_manifest_sha256, policy_version,
           decision_source
         )
         VALUES ($1, $2, $3, 'approve', 'Fixture Blessing.', '[]'::jsonb,
           $4, 'task-review-v1', 'human')`,
        [round.id, assignment.id, reviewerId, manifestHash]
      );
    }
    const pmAssignment = (await client.query(
      `INSERT INTO task_review_assignments (
         review_round_id, reviewer_user_id, reviewer_role, status,
         accepted_at, conflict_snapshot, eligibility_snapshot
       )
       VALUES ($1, $2, 'pm_reviewer', 'completed', NOW(), '{}'::jsonb, '{}'::jsonb)
       RETURNING id`,
      [round.id, state.actors.b.id]
    )).rows[0];
    await client.query(
      `INSERT INTO task_review_decisions (
         review_round_id, assignment_id, reviewer_user_id, decision, reason,
         requirement_findings, evidence_manifest_sha256, policy_version,
         decision_source
       )
       VALUES ($1, $2, $3, 'approve', 'Fixture Ritual Seal.', '[]'::jsonb,
         $4, 'task-review-v1', 'human')`,
      [round.id, pmAssignment.id, state.actors.b.id, manifestHash]
    );
    await client.query(
      `INSERT INTO task_acceptance_records (
         task_id, bundle_id, validation_result_id, review_round_id,
         evidence_manifest_sha256, peer_gate_method, pm_gate_method,
         policy_version, settlement_status
       )
       VALUES ($1, $2, $3, $4, $5, 'human', 'human', 'task-review-v1', 'pending')`,
      [task.id, bundle.id, validation.id, round.id, manifestHash]
    );
    await client.query("COMMIT");
    return {
      key,
      projectId: Number(project.id),
      taskId: Number(task.id),
      dependentTaskIds,
      contributorId: state.actors.a.id,
      peerIds,
      pmId: state.actors.b.id
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

export async function settlementReport(seed: SettlementSeed) {
  const state = readRealStackState();
  const client = new Client({ connectionString: state.database.url });
  await client.connect();
  try {
    const settlement = (await client.query(`SELECT * FROM task_settlements WHERE task_id = $1 ORDER BY id DESC LIMIT 1`, [seed.taskId])).rows[0];
    if (!settlement) return { status: "missing" };
    const counts = (await client.query(
      `SELECT
         (SELECT COUNT(*)::int FROM task_completion_records WHERE settlement_id = $1) AS completions,
         (SELECT COUNT(*)::int FROM reward_ledger_events WHERE settlement_id = $1) AS rewards,
         (SELECT COUNT(*)::int FROM skill_xp_events WHERE settlement_id = $1) AS xp,
         (SELECT COUNT(*)::int FROM task_settlement_events WHERE settlement_id = $1 AND event_type = 'task.completed') AS completion_events,
         (SELECT COUNT(*)::int FROM task_settlement_outbox WHERE settlement_id = $1) AS outbox,
         (SELECT COUNT(*)::int FROM task_settlement_outbox WHERE settlement_id = $1 AND status = 'delivered') AS outbox_delivered,
         (SELECT COUNT(*)::int FROM tasks WHERE id = ANY($2::int[]) AND status::text LIKE 'active%') AS activated`,
      [settlement.id, seed.dependentTaskIds]
    )).rows[0];
    const task = (await client.query(`SELECT status FROM tasks WHERE id = $1`, [seed.taskId])).rows[0];
    const acceptance = (await client.query(`SELECT settlement_status FROM task_acceptance_records WHERE task_id = $1 ORDER BY id DESC LIMIT 1`, [seed.taskId])).rows[0];
    return {
      status: settlement.status,
      settlementId: String(settlement.settlement_uuid),
      taskStatus: task?.status,
      acceptanceStatus: acceptance?.settlement_status,
      attemptCount: Number(settlement.attempt_count || 0),
      completions: Number(counts.completions),
      rewards: Number(counts.rewards),
      xp: Number(counts.xp),
      completionEvents: Number(counts.completion_events),
      outbox: Number(counts.outbox),
      outboxDelivered: Number(counts.outbox_delivered),
      activated: Number(counts.activated)
    };
  } finally {
    await client.end();
  }
}

export async function expectCommittedSettlement(seed: SettlementSeed) {
  await expect.poll(async () => (await settlementReport(seed)).status, { timeout: 30_000 }).toBe("completed");
  await expect.poll(async () => (await settlementReport(seed)).outboxDelivered, { timeout: 30_000 }).toBe(4);
  const report = await settlementReport(seed);
  expect(report).toMatchObject({
    status: "completed",
    taskStatus: "completed",
    acceptanceStatus: "settled",
    completions: 1,
    rewards: 5,
    xp: 1,
    completionEvents: 1,
    outbox: 4,
    outboxDelivered: 4,
    activated: seed.dependentTaskIds.length
  });
  return report;
}
