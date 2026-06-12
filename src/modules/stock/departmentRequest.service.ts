import { Department } from '@prisma/client'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { recordMovement } from '../stock/stock.service'

// ─── Create a request ─────────────────────────────────────────────────────────

export async function createRequest(
  data: {
    department: Department
    items: Array<{ itemId: string; quantity: number }>
    note?: string
  },
  staffId: string,
  shiftId?: string
) {
  if (!data.items?.length) throw new AppError(400, 'At least one item is required', 'VALIDATION')

  // Validate all items exist
  for (const entry of data.items) {
    const item = await prisma.inventoryItem.findUnique({ where: { id: entry.itemId } })
    if (!item) throw new AppError(404, `Item ${entry.itemId} not found`, 'NOT_FOUND')
    if (entry.quantity <= 0) throw new AppError(400, `Quantity for item ${entry.itemId} must be > 0`, 'VALIDATION')
  }

  const request = await prisma.departmentRequest.create({
    data: {
      department: data.department,
      requestedById: staffId,
      note: data.note,
      items: {
        create: data.items.map((i) => ({
          itemId: i.itemId,
          quantity: i.quantity,
        })),
      },
    },
    include: { items: { include: { item: true } } },
  })

  await logActivity({
    actionType: 'DEPARTMENT_REQUEST_CREATED',
    entityType: 'DEPARTMENT_REQUEST',
    entityId: request.id,
    staffId,
    shiftId,
    metadata: { department: data.department, itemCount: data.items.length },
  })

  return request
}

// ─── List requests ────────────────────────────────────────────────────────────

export async function getRequests(filters?: {
  department?: Department
  status?: string
}) {
  return prisma.departmentRequest.findMany({
    where: {
      ...(filters?.department && { department: filters.department }),
      ...(filters?.status && { status: filters.status as any }),
    },
    include: {
      items: { include: { item: { include: { category: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getRequestById(id: string) {
  const request = await prisma.departmentRequest.findUnique({
    where: { id },
    include: {
      items: { include: { item: { include: { category: true } } } },
      stockMovements: true,
    },
  })
  if (!request) throw new AppError(404, 'Request not found', 'NOT_FOUND')
  return request
}

// ─── Approve and fulfil ───────────────────────────────────────────────────────

export async function approveAndFulfil(
  requestId: string,
  staffId: string,
  shiftId?: string,
  reviewNote?: string
) {
  const request = await prisma.departmentRequest.findUnique({
    where: { id: requestId },
    include: { items: { include: { item: true } } },
  })

  if (!request) throw new AppError(404, 'Request not found', 'NOT_FOUND')
  if (request.status !== 'PENDING') {
    throw new AppError(409, `Request is already ${request.status}`, 'INVALID_STATE')
  }

  // Check stock availability for all items first
  for (const entry of request.items) {
    if (Number(entry.item.quantity) < Number(entry.quantity)) {
      throw new AppError(
        400,
        `Insufficient stock for "${entry.item.name}". Available: ${entry.item.quantity} ${entry.item.unit}, Requested: ${entry.quantity}`,
        'INSUFFICIENT_STOCK'
      )
    }
  }

  // Record OUT movement for each item
  const movements = []
  for (const entry of request.items) {
    const result = await recordMovement({
      itemId: entry.itemId,
      quantity: Number(entry.quantity),
      type: 'OUT',
      department: request.department,
      staffId,
      shiftId,
      requestId: request.id,
      note: `Issued to ${request.department} — Request #${request.id.slice(0, 8)}`,
    })
    movements.push(result.movement)

    // Update fulfilled quantity
    await prisma.departmentRequestItem.update({
      where: { id: entry.id },
      data: { fulfilledQty: entry.quantity },
    })
  }

  // Mark request as fulfilled
  await prisma.departmentRequest.update({
    where: { id: requestId },
    data: { status: 'FULFILLED', reviewedById: staffId, reviewNote },
  })

  await logActivity({
    actionType: 'DEPARTMENT_REQUEST_FULFILLED',
    entityType: 'DEPARTMENT_REQUEST',
    entityId: requestId,
    staffId,
    shiftId,
    metadata: { department: request.department, itemCount: request.items.length },
  })

  return { requestId, movements }
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectRequest(
  requestId: string,
  staffId: string,
  shiftId?: string,
  reviewNote?: string
) {
  const request = await prisma.departmentRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new AppError(404, 'Request not found', 'NOT_FOUND')
  if (request.status !== 'PENDING') {
    throw new AppError(409, `Request is already ${request.status}`, 'INVALID_STATE')
  }

  const updated = await prisma.departmentRequest.update({
    where: { id: requestId },
    data: { status: 'REJECTED', reviewedById: staffId, reviewNote },
  })

  await logActivity({
    actionType: 'DEPARTMENT_REQUEST_REJECTED',
    entityType: 'DEPARTMENT_REQUEST',
    entityId: requestId,
    staffId,
    shiftId,
    metadata: { department: request.department, reviewNote },
  })

  return updated
}