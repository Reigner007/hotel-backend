import { ActionType, EntityType } from '@prisma/client'
import prisma from '../../shared/db/prisma'

interface LogActivityParams {
  actionType: ActionType
  entityType: EntityType
  entityId: string
  staffId: string
  shiftId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
}

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actionType: params.actionType,
        entityType: params.entityType,
        entityId: params.entityId,
        staffId: params.staffId,
        shiftId: params.shiftId ?? null,
        metadata: params.metadata ?? {},
        ipAddress: params.ipAddress ?? null,
      },
    })
  } catch (err) {
    // Activity log failure must never crash the main request
    console.error('[ActivityLog] Failed to write log:', err)
  }
}