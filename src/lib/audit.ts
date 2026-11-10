import { getPbClient } from './pb';

export interface AuditParams {
  actorLabel?: string;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: any;
  after?: any;
}

export async function logAudit({
  actorLabel = 'Admin',
  action,
  entity,
  entityId = null,
  before = null,
  after = null,
}: AuditParams) {
  try {
    const pb = await getPbClient();
    await pb.collection('audit_log').create({
      actor_label: actorLabel,
      action,
      entity,
      entity_id: entityId || '',
      before: before || null,
      after: after || null,
    });
  } catch (error) {
    console.error('Failed to write audit log to PocketBase:', error);
  }
}
