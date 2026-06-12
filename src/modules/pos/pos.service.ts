import { OrderType, PosPaymentMethod } from '@prisma/client'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { recordMovement } from '../stock/stock.service'

// ─── Create order ─────────────────────────────────────────────────────────────

export async function createOrder(data: {
  type: OrderType
  tableRef?: string
  roomId?: string
  staffId: string
  shiftId?: string
  note?: string
  items: Array<{ productId: string; quantity: number; notes?: string }>
}) {
  if (!data.items?.length) throw new AppError(400, 'Order must have at least one item', 'VALIDATION')

  if (data.type === 'ROOM_SERVICE' && !data.roomId) {
    throw new AppError(400, 'roomId is required for ROOM_SERVICE orders', 'VALIDATION')
  }
  if (data.type === 'DINE_IN' && !data.tableRef) {
    throw new AppError(400, 'tableRef is required for DINE_IN orders', 'VALIDATION')
  }

  // Validate all products exist and are available
  const products = await Promise.all(
    data.items.map(async (item) => {
      const product = await prisma.posProduct.findUnique({ where: { id: item.productId } })
      if (!product) throw new AppError(404, `Product ${item.productId} not found`, 'NOT_FOUND')
      if (!product.isAvailable) throw new AppError(400, `"${product.name}" is currently unavailable`, 'UNAVAILABLE')
      return product
    })
  )

  // Calculate totals
  const orderItems = data.items.map((item, i) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: Number(products[i].price),
    totalPrice: Number(products[i].price) * item.quantity,
    notes: item.notes ?? null,
    sentToKitchen: false,
  }))
  const totalAmount = orderItems.reduce((sum, i) => sum + i.totalPrice, 0)

  const order = await prisma.posOrder.create({
    data: {
      type: data.type,
      roomId: data.roomId ?? null,
      tableRef: data.tableRef ?? null,
      staffId: data.staffId,
      shiftId: data.shiftId ?? null,
      note: data.note ?? null,
      totalAmount,
      items: { create: orderItems },
    },
    include: { items: { include: { product: true } }, room: true },
  })

  await logActivity({
    actionType: 'POS_ORDER_CREATED',
    entityType: 'POS_ORDER',
    entityId: order.id,
    staffId: data.staffId,
    shiftId: data.shiftId,
    metadata: { type: data.type, itemCount: data.items.length, totalAmount },
  })

  return order
}

// ─── Charge order ─────────────────────────────────────────────────────────────

export async function chargeOrder(
  orderId: string,
  payments: Array<{ method: PosPaymentMethod; amount: number; reference?: string; note?: string }>,
  staffId: string,
  shiftId?: string
) {
  const order = await prisma.posOrder.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { include: { inventoryItem: true } } } } },
  })

  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND')
  if (order.status !== 'OPEN') throw new AppError(409, `Order is already ${order.status}`, 'INVALID_STATE')

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  if (Math.abs(totalPaid - Number(order.totalAmount)) > 0.01) {
    throw new AppError(400, `Payment total (${totalPaid}) does not match order total (${order.totalAmount})`, 'PAYMENT_MISMATCH')
  }

  await prisma.$transaction(async (tx) => {
    // Record payments
    for (const payment of payments) {
      await tx.posPayment.create({
        data: {
          orderId: order.id,
          amount: payment.amount,
          method: payment.method,
          reference: payment.reference ?? null,
          note: payment.note ?? null,
          staffId,
          shiftId: shiftId ?? null,
        },
      })
    }

    // If POST_TO_ROOM — add line item to guest bill
    const roomCharge = payments.find((p) => p.method === 'POST_TO_ROOM')
    if (roomCharge && order.roomId) {
      const stay = await tx.stay.findFirst({
        where: { roomId: order.roomId, checkOutAt: null },
        include: { bill: true },
      })
      if (!stay?.bill) throw new AppError(404, 'No active stay/bill found for this room', 'NOT_FOUND')
      await tx.billLineItem.create({
        data: {
          billId: stay.bill.id,
          description: `POS charge — Order #${order.id.slice(0, 8)}`,
          quantity: 1,
          unitPrice: roomCharge.amount,
          totalPrice: roomCharge.amount,
        },
      })
      await tx.bill.update({
        where: { id: stay.bill.id },
        data: { totalAmount: { increment: roomCharge.amount } },
      })
    }

    // Send food items to kitchen
    const foodItems = order.items.filter((i) => i.product.type === 'FOOD')
    if (foodItems.length > 0) {
      await tx.kitchenTicket.create({
        data: {
          orderId: order.id,
          note: order.note,
          items: {
            create: foodItems.map((i) => ({
              productId: i.productId,
              productName: i.product.name,
              quantity: i.quantity,
              notes: i.notes,
            })),
          },
        },
      })
      // Mark food items as sent to kitchen
      await tx.posOrderItem.updateMany({
        where: { orderId: order.id, product: { type: 'FOOD' } },
        data: { sentToKitchen: true },
      })
    }

    // Deduct bar/beverage stock immediately
    for (const item of order.items) {
      if (item.product.type === 'BEVERAGE' && item.product.linkedInventoryItemId) {
        await recordMovement({
          itemId: item.product.linkedInventoryItemId,
          quantity: item.quantity,
          type: 'USAGE',
          department: 'BAR',
          staffId,
          shiftId,
          note: `POS sale — Order #${order.id.slice(0, 8)}`,
        })
      }
    }

    // Update order status to CHARGED
    await tx.posOrder.update({
      where: { id: order.id },
      data: { status: 'CHARGED' },
    })
  })

  await logActivity({
    actionType: 'POS_ORDER_CHARGED',
    entityType: 'POS_ORDER',
    entityId: order.id,
    staffId,
    shiftId,
    metadata: { totalAmount: order.totalAmount, paymentMethods: payments.map((p) => p.method) },
  })

  return prisma.posOrder.findUnique({
    where: { id: order.id },
    include: { items: { include: { product: true } }, payments: true, ticket: true },
  })
}

// ─── Complete order (waiter delivered) ───────────────────────────────────────

export async function completeOrder(orderId: string, staffId: string, shiftId?: string) {
  const order = await prisma.posOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND')
  if (order.status !== 'CHARGED') throw new AppError(409, 'Order must be CHARGED before completing', 'INVALID_STATE')

  await prisma.posOrder.update({ where: { id: orderId }, data: { status: 'COMPLETED' } })

  await logActivity({
    actionType: 'POS_ORDER_COMPLETED',
    entityType: 'POS_ORDER',
    entityId: orderId,
    staffId,
    shiftId,
  })

  return prisma.posOrder.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: true } }, payments: true },
  })
}

// ─── Void order ───────────────────────────────────────────────────────────────

export async function voidOrder(
  orderId: string,
  staffId: string,
  shiftId?: string,
  reason?: string
) {
  const order = await prisma.posOrder.findUnique({ where: { id: orderId } })
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND')
  if (order.status === 'VOIDED') throw new AppError(409, 'Order is already voided', 'CONFLICT')
  if (order.status === 'COMPLETED') throw new AppError(400, 'Cannot void a completed order', 'INVALID_STATE')
  if (!reason) throw new AppError(400, 'Void reason is required', 'VALIDATION')

  await prisma.posOrder.update({
    where: { id: orderId },
    data: { status: 'VOIDED', voidedById: staffId, voidReason: reason },
  })

  await logActivity({
    actionType: 'POS_ORDER_VOIDED',
    entityType: 'POS_ORDER',
    entityId: orderId,
    staffId,
    shiftId,
    metadata: { reason },
  })
}

// ─── Get orders ───────────────────────────────────────────────────────────────

export async function getOrders(filters?: {
  status?: string
  type?: string
  staffId?: string
  date?: string
}) {
  return prisma.posOrder.findMany({
    where: {
      ...(filters?.status && { status: filters.status as any }),
      ...(filters?.type && { type: filters.type as any }),
      ...(filters?.staffId && { staffId: filters.staffId }),
      ...(filters?.date && {
        createdAt: {
          gte: new Date(filters.date),
          lt: new Date(new Date(filters.date).getTime() + 86400000),
        },
      }),
    },
    include: { items: { include: { product: true } }, payments: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
}

export async function getOrderById(id: string) {
  const order = await prisma.posOrder.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      payments: true,
      ticket: { include: { items: true } },
      room: true,
    },
  })
  if (!order) throw new AppError(404, 'Order not found', 'NOT_FOUND')
  return order
}