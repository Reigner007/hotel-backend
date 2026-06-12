import { KitchenItemStatus, KitchenTicketStatus } from '@prisma/client'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { recordMovement } from '../stock/stock.service'

// ─── Get all tickets ──────────────────────────────────────────────────────────

export async function getTickets(filters?: { status?: KitchenTicketStatus }) {
  return prisma.kitchenTicket.findMany({
    where: { ...(filters?.status && { status: filters.status }) },
    include: {
      items: true,
      order: { select: { type: true, tableRef: true, roomId: true, note: true, createdAt: true } },
    },
    orderBy: { createdAt: 'asc' }, // oldest first — FIFO kitchen queue
  })
}

export async function getTicketById(id: string) {
  const ticket = await prisma.kitchenTicket.findUnique({
    where: { id },
    include: {
      items: true,
      order: {
        include: { room: true },
      },
    },
  })
  if (!ticket) throw new AppError(404, 'Kitchen ticket not found', 'NOT_FOUND')
  return ticket
}

// ─── Update ticket item status ────────────────────────────────────────────────

export async function updateItemStatus(
  ticketId: string,
  itemId: string,
  status: KitchenItemStatus,
  staffId: string,
  shiftId?: string,
  assignedTo?: string
) {
  const item = await prisma.kitchenTicketItem.findFirst({
    where: { id: itemId, ticketId },
  })
  if (!item) throw new AppError(404, 'Ticket item not found', 'NOT_FOUND')

  const updateData: any = { status }
  if (status === 'PREPARING' || status === 'COOKING') {
    updateData.startedAt = item.startedAt ?? new Date()
    if (assignedTo) updateData.assignedTo = assignedTo
  }
  if (status === 'DONE') {
    updateData.completedAt = new Date()
  }

  const updated = await prisma.kitchenTicketItem.update({
    where: { id: itemId },
    data: updateData,
  })

  // Auto-update ticket status based on all item statuses
  await syncTicketStatus(ticketId, staffId, shiftId)

  return updated
}

// ─── Mark ticket as ready ─────────────────────────────────────────────────────

export async function markTicketReady(ticketId: string, staffId: string, shiftId?: string) {
  const ticket = await prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
    include: { items: true },
  })
  if (!ticket) throw new AppError(404, 'Kitchen ticket not found', 'NOT_FOUND')
  if (ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED') {
    throw new AppError(409, `Ticket is already ${ticket.status}`, 'INVALID_STATE')
  }

  // Mark all non-cancelled items as DONE
  await prisma.kitchenTicketItem.updateMany({
    where: { ticketId, status: { notIn: ['CANCELLED', 'DONE'] } },
    data: { status: 'DONE', completedAt: new Date() },
  })

  await prisma.kitchenTicket.update({
    where: { id: ticketId },
    data: { status: 'READY' },
  })

  await logActivity({
    actionType: 'KITCHEN_TICKET_READY',
    entityType: 'KITCHEN_TICKET',
    entityId: ticketId,
    staffId,
    shiftId,
    metadata: { orderId: ticket.orderId },
  })

  return prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
    include: { items: true },
  })
}

// ─── Complete ticket (food delivered) ────────────────────────────────────────

export async function completeTicket(ticketId: string, staffId: string, shiftId?: string) {
  const ticket = await prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
    include: { items: { include: { product: { include: { inventoryItem: true } } } as any } },
  })
  if (!ticket) throw new AppError(404, 'Kitchen ticket not found', 'NOT_FOUND')
  if (ticket.status !== 'READY') {
    throw new AppError(400, 'Ticket must be READY before completing', 'INVALID_STATE')
  }

  // Deduct kitchen ingredients stock for food items
  const ticketWithItems = await prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
    include: {
      items: true,
      order: { include: { items: { include: { product: { include: { inventoryItem: true } } } } } },
    },
  })

  for (const orderItem of ticketWithItems!.order.items) {
    if (
      orderItem.product.type === 'FOOD' &&
      orderItem.product.linkedInventoryItemId
    ) {
      await recordMovement({
        itemId: orderItem.product.linkedInventoryItemId,
        quantity: orderItem.quantity,
        type: 'USAGE',
        department: 'KITCHEN',
        staffId,
        shiftId,
        note: `Kitchen production — Ticket #${ticketId.slice(0, 8)}`,
      })
    }
  }

  await prisma.kitchenTicket.update({ where: { id: ticketId }, data: { status: 'COMPLETED' } })

  await logActivity({
    actionType: 'KITCHEN_TICKET_UPDATED',
    entityType: 'KITCHEN_TICKET',
    entityId: ticketId,
    staffId,
    shiftId,
    metadata: { status: 'COMPLETED' },
  })

  return prisma.kitchenTicket.findUnique({ where: { id: ticketId }, include: { items: true } })
}

// ─── Cancel ticket ────────────────────────────────────────────────────────────

export async function cancelTicket(
  ticketId: string,
  staffId: string,
  shiftId?: string,
  reason?: string
) {
  const ticket = await prisma.kitchenTicket.findUnique({
    where: { id: ticketId },
    include: { items: true },
  })
  if (!ticket) throw new AppError(404, 'Kitchen ticket not found', 'NOT_FOUND')
  if (ticket.status === 'COMPLETED' || ticket.status === 'CANCELLED') {
    throw new AppError(409, `Ticket is already ${ticket.status}`, 'INVALID_STATE')
  }

  // Identify items that were already being prepared — generate waste logs
  const startedItems = ticket.items.filter(
    (i) => i.status === 'PREPARING' || i.status === 'COOKING' || i.status === 'DONE'
  )

  if (startedItems.length > 0) {
    await prisma.wasteLog.createMany({
      data: startedItems.map((item) => ({
        ticketId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        reason: reason ?? 'Order cancelled after preparation started',
        staffId,
        shiftId: shiftId ?? null,
      })),
    })
  }

  await prisma.$transaction(async (tx) => {
    await tx.kitchenTicketItem.updateMany({
      where: { ticketId },
      data: { status: 'CANCELLED' },
    })
    await tx.kitchenTicket.update({
      where: { id: ticketId },
      data: { status: 'CANCELLED' },
    })
  })

  await logActivity({
    actionType: 'KITCHEN_TICKET_CANCELLED',
    entityType: 'KITCHEN_TICKET',
    entityId: ticketId,
    staffId,
    shiftId,
    metadata: { reason, wasteLogsCreated: startedItems.length },
  })

  return { ticketId, wasteLogsCreated: startedItems.length }
}

// ─── Internal: sync ticket status from item statuses ─────────────────────────

async function syncTicketStatus(ticketId: string, staffId: string, shiftId?: string) {
  const items = await prisma.kitchenTicketItem.findMany({ where: { ticketId } })
  const active = items.filter((i) => i.status !== 'CANCELLED')

  let newStatus: KitchenTicketStatus = 'RECEIVED'
  if (active.every((i) => i.status === 'DONE')) {
    newStatus = 'READY'
  } else if (active.some((i) => i.status === 'COOKING' || i.status === 'PREPARING')) {
    newStatus = 'IN_PROGRESS'
  }

  await prisma.kitchenTicket.update({ where: { id: ticketId }, data: { status: newStatus } })

  await logActivity({
    actionType: 'KITCHEN_TICKET_UPDATED',
    entityType: 'KITCHEN_TICKET',
    entityId: ticketId,
    staffId,
    shiftId,
    metadata: { status: newStatus },
  })
}