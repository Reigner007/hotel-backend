import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { recordMovement } from '../stock/stock.service'

// ─── Start a cleaning session ─────────────────────────────────────────────────

export async function startCleaning(
  data: { roomId?: string; roomNumber?: string; staffId: string; shiftId?: string; notes?: string }
) {
  let room
  if (data.roomId) {
    room = await prisma.room.findUnique({ where: { id: data.roomId } })
  } else if (data.roomNumber) {
    room = await prisma.room.findFirst({ where: { roomNumber: data.roomNumber } })
  }
  if (!room) throw new AppError(404, 'Room not found', 'NOT_FOUND')
  if (room.status !== 'CLEANING') {
    throw new AppError(400, `Room must be in CLEANING status to start housekeeping. Current status: ${room.status}`, 'INVALID_STATE')
  }

  // Check no active log already exists for this room
  const active = await prisma.housekeepingLog.findFirst({
    where: { roomId: room.id, completedAt: null },
  })
  if (active) throw new AppError(409, 'An active cleaning session already exists for this room', 'CONFLICT')

  const log = await prisma.housekeepingLog.create({
    data: {
      roomId: room.id,
      staffId: data.staffId,
      shiftId: data.shiftId ?? null,
      notes: data.notes,
    },
    include: { room: true },
  })

  await logActivity({
    actionType: 'HOUSEKEEPING_STARTED',
    entityType: 'HOUSEKEEPING_LOG',
    entityId: log.id,
    staffId: data.staffId,
    shiftId: data.shiftId,
    metadata: { roomId: room.id, roomNumber: room.roomNumber },
  })

  return log
}

// ─── Complete a cleaning session ──────────────────────────────────────────────

export async function completeCleaning(
  logId: string,
  staffId: string,
  shiftId?: string,
  notes?: string
) {
  const log = await prisma.housekeepingLog.findUnique({
    where: { id: logId },
    include: { room: true },
  })
  if (!log) throw new AppError(404, 'Housekeeping log not found', 'NOT_FOUND')
  if (log.completedAt) throw new AppError(409, 'Cleaning session already completed', 'CONFLICT')

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.housekeepingLog.update({
      where: { id: logId },
      data: { completedAt: new Date(), notes: notes ?? log.notes },
      include: { room: true },
    })
    // Set room back to AVAILABLE
    await tx.room.update({
      where: { id: log.roomId },
      data: { status: 'AVAILABLE' },
    })
    return updated
  })

  await logActivity({
    actionType: 'HOUSEKEEPING_COMPLETED',
    entityType: 'HOUSEKEEPING_LOG',
    entityId: logId,
    staffId,
    shiftId,
    metadata: { roomId: log.roomId, roomNumber: log.room.roomNumber },
  })

  return updated
}

// ─── Record item usage during cleaning ───────────────────────────────────────

export async function recordUsage(
  data: {
    housekeepingLogId: string
    items: Array<{ itemId: string; quantity: number }>
    staffId: string
    shiftId?: string
  }
) {
  const log = await prisma.housekeepingLog.findUnique({ where: { id: data.housekeepingLogId } })
  if (!log) throw new AppError(404, 'Housekeeping log not found', 'NOT_FOUND')
  if (log.completedAt) throw new AppError(400, 'Cannot record usage on a completed session', 'INVALID_STATE')

  const usages = []
  for (const entry of data.items) {
    // Record USAGE stock movement
    await recordMovement({
      itemId: entry.itemId,
      quantity: entry.quantity,
      type: 'USAGE',
      department: 'HOUSEKEEPING',
      staffId: data.staffId,
      shiftId: data.shiftId,
      note: `Used during room cleaning — Log #${data.housekeepingLogId.slice(0, 8)}`,
    })

    const usage = await prisma.housekeepingUsage.create({
      data: {
        housekeepingLogId: data.housekeepingLogId,
        itemId: entry.itemId,
        quantity: entry.quantity,
        staffId: data.staffId,
        shiftId: data.shiftId ?? null,
      },
      include: { item: true },
    })
    usages.push(usage)
  }

  await logActivity({
    actionType: 'HOUSEKEEPING_USAGE_RECORDED',
    entityType: 'HOUSEKEEPING_LOG',
    entityId: data.housekeepingLogId,
    staffId: data.staffId,
    shiftId: data.shiftId,
    metadata: { itemCount: data.items.length },
  })

  return usages
}

// ─── Get logs ─────────────────────────────────────────────────────────────────

export async function getLogs(filters?: { roomId?: string; staffId?: string; active?: boolean }) {
  return prisma.housekeepingLog.findMany({
    where: {
      ...(filters?.roomId && { roomId: filters.roomId }),
      ...(filters?.staffId && { staffId: filters.staffId }),
      ...(filters?.active && { completedAt: null }),
    },
    include: {
      room: true,
      usages: { include: { item: { include: { category: true } } } },
    },
    orderBy: { startedAt: 'desc' },
    take: 100,
  })
}

export async function getLogById(id: string) {
  const log = await prisma.housekeepingLog.findUnique({
    where: { id },
    include: {
      room: true,
      usages: { include: { item: { include: { category: true } } } },
    },
  })
  if (!log) throw new AppError(404, 'Housekeeping log not found', 'NOT_FOUND')
  return log
}