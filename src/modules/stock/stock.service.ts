import { Department, StockMovementType } from '@prisma/client'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { resolveItemStatus } from '../inventory/inventory.service'

// ─── Record a stock movement and update item quantity ─────────────────────────

export async function recordMovement(
  data: {
    itemId: string
    quantity: number
    type: StockMovementType
    department: Department
    staffId: string
    shiftId?: string
    requestId?: string
    note?: string
  }
) {
  const item = await prisma.inventoryItem.findUnique({ where: { id: data.itemId } })
  if (!item) throw new AppError(404, 'Inventory item not found', 'NOT_FOUND')

  // Calculate new quantity
  const current = Number(item.quantity)
  let newQty: number

  if (data.type === 'IN' || data.type === 'RETURN') {
    newQty = current + data.quantity
  } else {
    // OUT, USAGE, ADJUSTMENT
    if (data.quantity > current) {
      throw new AppError(400, `Insufficient stock. Available: ${current} ${item.unit}`, 'INSUFFICIENT_STOCK')
    }
    newQty = current - data.quantity
  }

  const newStatus = resolveItemStatus(newQty, Number(item.reorderLevel))

  const movement = await prisma.$transaction(async (tx) => {
    const movement = await tx.stockMovement.create({
      data: {
        itemId: data.itemId,
        quantity: data.quantity,
        type: data.type,
        department: data.department,
        staffId: data.staffId,
        shiftId: data.shiftId ?? null,
        requestId: data.requestId ?? null,
        note: data.note ?? null,
      },
      include: { item: true },
    })

    await tx.inventoryItem.update({
      where: { id: data.itemId },
      data: { quantity: newQty, status: newStatus },
    })

    return movement
  })

  // Log the action
  const actionMap: Record<StockMovementType, any> = {
    IN: 'STOCK_IN',
    OUT: 'STOCK_OUT',
    USAGE: 'ITEM_USAGE_RECORDED',
    ADJUSTMENT: 'STOCK_ADJUSTED',
    RETURN: 'STOCK_RETURNED',
  }

  await logActivity({
    actionType: actionMap[data.type],
    entityType: 'STOCK_MOVEMENT',
    entityId: movement.id,
    staffId: data.staffId,
    shiftId: data.shiftId,
    metadata: {
      itemId: data.itemId,
      itemName: movement.item.name,
      quantity: data.quantity,
      type: data.type,
      department: data.department,
      previousQty: current,
      newQty,
      newStatus,
    },
  })

  return { movement, newQuantity: newQty, newStatus }
}

// ─── Get movement history ─────────────────────────────────────────────────────

export async function getMovements(filters?: {
  itemId?: string
  type?: StockMovementType
  department?: Department
  from?: string
  to?: string
  limit?: number
}) {
  return prisma.stockMovement.findMany({
    where: {
      ...(filters?.itemId && { itemId: filters.itemId }),
      ...(filters?.type && { type: filters.type }),
      ...(filters?.department && { department: filters.department }),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters?.from && { gte: new Date(filters.from) }),
              ...(filters?.to && { lte: new Date(filters.to) }),
            },
          }
        : {}),
    },
    include: { item: { include: { category: true } } },
    orderBy: { createdAt: 'desc' },
    take: filters?.limit ?? 100,
  })
}