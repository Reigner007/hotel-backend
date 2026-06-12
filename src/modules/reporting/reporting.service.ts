import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'

// ─── Generate daily summary ───────────────────────────────────────────────────

export async function generateDailySummary(date: Date, staffId: string) {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(date)
  end.setHours(23, 59, 59, 999)

  const dateOnly = new Date(start)

  // Check if summary already exists for this date
  const existing = await prisma.dailySummary.findUnique({ where: { date: dateOnly } })
  if (existing) throw new AppError(409, 'Daily summary already exists for this date', 'CONFLICT')

  // ── Total revenue (payments received today) ───────────────────────────────
  const revenueResult = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: {
      processedAt: { gte: start, lte: end },
      status: 'SUCCESS',
    },
  })
  const totalRevenue = Number(revenueResult._sum.amount ?? 0)

  // ── POS sales total ────────────────────────────────────────────────────────
  const posResult = await prisma.posPayment.aggregate({
    _sum: { amount: true },
    where: { processedAt: { gte: start, lte: end } },
  })
  const totalPosSales = Number(posResult._sum.amount ?? 0)

  // ── Occupancy ──────────────────────────────────────────────────────────────
  const totalRooms = await prisma.room.count()
  const occupiedRooms = await prisma.stay.count({
    where: {
      checkInAt: { lte: end },
      OR: [{ checkOutAt: null }, { checkOutAt: { gte: start } }],
    },
  })
  const occupancyRate = totalRooms > 0
    ? parseFloat(((occupiedRooms / totalRooms) * 100).toFixed(2))
    : 0

  // ── Check-ins and check-outs ───────────────────────────────────────────────
  const totalCheckins = await prisma.stay.count({
    where: { checkInAt: { gte: start, lte: end } },
  })
  const totalCheckouts = await prisma.stay.count({
    where: { checkOutAt: { gte: start, lte: end } },
  })

  // ── Top selling POS items ──────────────────────────────────────────────────
  const topItemsRaw = await prisma.posOrderItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true, totalPrice: true },
    where: {
      order: {
        status: { in: ['CHARGED', 'COMPLETED'] },
        createdAt: { gte: start, lte: end },
      },
    },
    orderBy: { _sum: { totalPrice: 'desc' } },
    take: 10,
  })

  const topSellingItems = await Promise.all(
    topItemsRaw.map(async (row) => {
      const product = await prisma.posProduct.findUnique({
        where: { id: row.productId },
        select: { name: true },
      })
      return {
        productId: row.productId,
        name: product?.name ?? 'Unknown',
        qty: row._sum.quantity ?? 0,
        revenue: Number(row._sum.totalPrice ?? 0),
      }
    })
  )

  // ── Stock movements summary ────────────────────────────────────────────────
  const stockIn = await prisma.stockMovement.aggregate({
    _sum: { quantity: true },
    where: { type: 'IN', createdAt: { gte: start, lte: end } },
  })
  const stockOut = await prisma.stockMovement.aggregate({
    _sum: { quantity: true },
    where: { type: 'OUT', createdAt: { gte: start, lte: end } },
  })
  const stockUsage = await prisma.stockMovement.aggregate({
    _sum: { quantity: true },
    where: { type: 'USAGE', createdAt: { gte: start, lte: end } },
  })
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: { status: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] } },
    select: { id: true, name: true, quantity: true, unit: true, status: true },
  })

  const stockMovementsSummary = {
    totalIn: Number(stockIn._sum.quantity ?? 0),
    totalOut: Number(stockOut._sum.quantity ?? 0),
    totalUsage: Number(stockUsage._sum.quantity ?? 0),
    lowStockItems,
  }

  // ── Write summary ──────────────────────────────────────────────────────────
  const summary = await prisma.dailySummary.create({
    data: {
      date: dateOnly,
      totalRevenue,
      occupancyRate,
      totalCheckins,
      totalCheckouts,
      totalPosSales,
      topSellingItems,
      stockMovementsSummary,
    },
  })

  // ── Push to sync outbox for cloud pickup ──────────────────────────────────
  await prisma.syncOutbox.create({
    data: {
      eventType: 'DAILY_SUMMARY',
      payload: {
        date: dateOnly.toISOString(),
        totalRevenue,
        occupancyRate,
        totalCheckins,
        totalCheckouts,
        totalPosSales,
        topSellingItems,
        stockMovementsSummary,
        summaryId: summary.id,
      },
    },
  })

  await logActivity({
    actionType: 'DAILY_SUMMARY_GENERATED',
    entityType: 'DAILY_SUMMARY',
    entityId: summary.id,
    staffId,
    metadata: { date: dateOnly.toISOString(), totalRevenue, occupancyRate },
  })

  return summary
}

// ─── Get summaries ────────────────────────────────────────────────────────────

export async function getSummaries(filters?: { from?: string; to?: string; limit?: number }) {
  return prisma.dailySummary.findMany({
    where: {
      ...(filters?.from || filters?.to
        ? {
            date: {
              ...(filters?.from && { gte: new Date(filters.from) }),
              ...(filters?.to && { lte: new Date(filters.to) }),
            },
          }
        : {}),
    },
    orderBy: { date: 'desc' },
    take: filters?.limit ?? 30,
  })
}

export async function getSummaryByDate(date: string) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const summary = await prisma.dailySummary.findUnique({ where: { date: d } })
  if (!summary) throw new AppError(404, 'No summary found for this date', 'NOT_FOUND')
  return summary
}

// ─── Revenue report ───────────────────────────────────────────────────────────

export async function getRevenueReport(from: string, to: string) {
  const start = new Date(from)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)

  const [roomRevenue, posRevenue, paymentsByMethod] = await Promise.all([
    prisma.payment.aggregate({
      _sum: { amount: true },
      where: { processedAt: { gte: start, lte: end }, status: 'SUCCESS' },
    }),
    prisma.posPayment.aggregate({
      _sum: { amount: true },
      where: { processedAt: { gte: start, lte: end } },
    }),
    prisma.payment.groupBy({
      by: ['method'],
      _sum: { amount: true },
      where: { processedAt: { gte: start, lte: end }, status: 'SUCCESS' },
    }),
  ])

  return {
    period: { from, to },
    roomRevenue: Number(roomRevenue._sum.amount ?? 0),
    posRevenue: Number(posRevenue._sum.amount ?? 0),
    totalRevenue:
      Number(roomRevenue._sum.amount ?? 0) + Number(posRevenue._sum.amount ?? 0),
    byPaymentMethod: paymentsByMethod.map((r) => ({
      method: r.method,
      amount: Number(r._sum.amount ?? 0),
    })),
  }
}

// ─── Staff activity report ────────────────────────────────────────────────────

export async function getStaffActivityReport(staffId: string, from: string, to: string) {
  const start = new Date(from)
  const end = new Date(to)
  end.setHours(23, 59, 59, 999)

  const [logs, shiftLogs] = await Promise.all([
    prisma.activityLog.findMany({
      where: { staffId, timestamp: { gte: start, lte: end } },
      orderBy: { timestamp: 'desc' },
    }),
    prisma.shiftLog.findMany({
      where: { staffId, loginTime: { gte: start, lte: end } },
      include: { shift: true },
    }),
  ])

  const actionCounts = logs.reduce((acc: Record<string, number>, log) => {
    acc[log.actionType] = (acc[log.actionType] ?? 0) + 1
    return acc
  }, {})

  return {
    staffId,
    period: { from, to },
    totalActions: logs.length,
    actionBreakdown: actionCounts,
    shiftLogs,
  }
}

// ─── Sync outbox status ───────────────────────────────────────────────────────

export async function getSyncOutbox(status?: string) {
  return prisma.syncOutbox.findMany({
    where: { ...(status && { status: status as any }) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}