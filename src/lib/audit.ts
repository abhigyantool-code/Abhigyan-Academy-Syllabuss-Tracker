import { query } from './db';

export interface AuditParams {
  actorLabel?: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: any;
  after?: any;
}

export async function logAudit({
  actorLabel = 'Admin (Phase 1)',
  action,
  entity,
  entityId = null,
  before = null,
  after = null,
}: AuditParams) {
  try {
    await query(
      `INSERT INTO audit_log (actor_label, action, entity, entity_id, before, after)
       VALUES ($1, $2, $3, $4, $5, $6);`,
      [
        actorLabel,
        action,
        entity,
        entityId,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
      ]
    );
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}
