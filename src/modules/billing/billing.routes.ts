import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { AppError } from '../../shared/middleware/errorHandler'
import prisma from '../../shared/db/prisma'
import { PaymentMethod } from '@prisma/client'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Billing
 *   description: Bills, line items, and payments
 */

/**
 * @swagger
 * /billing/{billId}:
 *   get:
 *     summary: Get a bill by ID
 *     description: Returns the bill with all line items, payments, and stay/guest/room context.
 *     tags: [Billing]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Full bill details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Bill'
 *       404:
 *         description: Bill not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:billId', async (req, res, next) => {
  try {
    const bill = await prisma.bill.findUnique({
      where: { id: req.params.billId },
      include: {
        lineItems: true,
        payments: true,
        stay: { include: { guest: true, room: true } },
      },
    })
    if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND')
    res.json({ success: true, data: bill })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /billing/{billId}/pay:
 *   post:
 *     summary: Post a payment to a bill
 *     description: |
 *       Accepts partial or full payments.
 *       Bill status automatically updates: OPEN → PARTIAL → PAID.
 *       Payment methods: CASH, CARD, TRANSFER, COMPLIMENTARY.
 *     tags: [Billing]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PostPaymentRequest'
 *     responses:
 *       201:
 *         description: Payment posted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     payment:
 *                       $ref: '#/components/schemas/Payment'
 *                     billStatus:
 *                       $ref: '#/components/schemas/BillStatus'
 *       400:
 *         description: Cannot post payment to a voided bill
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bill not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Bill is already fully paid
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:billId/pay', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const { amount, method, reference, notes } = req.body
    if (!amount || !method) throw new AppError(400, 'amount and method are required', 'VALIDATION')
    if (!Object.values(PaymentMethod).includes(method)) {
      throw new AppError(400, `method must be one of: ${Object.values(PaymentMethod).join(', ')}`, 'VALIDATION')
    }

    const bill = await prisma.bill.findUnique({ where: { id: req.params.billId } })
    if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND')
    if (bill.status === 'PAID') throw new AppError(409, 'Bill is already fully paid', 'CONFLICT')
    if (bill.status === 'VOIDED') throw new AppError(400, 'Cannot post payment to a voided bill', 'INVALID_STATE')

    const newPaid = Number(bill.paidAmount) + Number(amount)
    const newStatus = newPaid >= Number(bill.totalAmount) ? 'PAID' : 'PARTIAL'

    const payment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { billId: bill.id, amount, method, reference, notes, staffId: req.staff!.staffId },
      })
      await tx.bill.update({ where: { id: bill.id }, data: { paidAmount: newPaid, status: newStatus } })
      return payment
    })

    await logActivity({
      actionType: 'PAYMENT_POSTED', entityType: 'PAYMENT',
      entityId: payment.id, staffId: req.staff!.staffId,
      metadata: { billId: bill.id, amount, method, newStatus },
    })

    res.status(201).json({ success: true, data: { payment, billStatus: newStatus } })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /billing/{billId}/line-items:
 *   post:
 *     summary: Add a charge to a bill
 *     description: Used to add extra charges such as room service, minibar, or POS items billed to room.
 *     tags: [Billing]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddLineItemRequest'
 *     responses:
 *       201:
 *         description: Line item added and bill total updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BillLineItem'
 *       404:
 *         description: Bill not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:billId/line-items', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const { description, quantity, unitPrice, category } = req.body
    if (!description || unitPrice === undefined) {
      throw new AppError(400, 'description and unitPrice are required', 'VALIDATION')
    }
    const qty = quantity ?? 1
    const totalPrice = Number(unitPrice) * qty

    const bill = await prisma.bill.findUnique({ where: { id: req.params.billId } })
    if (!bill) throw new AppError(404, 'Bill not found', 'NOT_FOUND')
    if (bill.status === 'VOIDED') throw new AppError(400, 'Cannot add charges to a voided bill', 'INVALID_STATE')

    const lineItem = await prisma.$transaction(async (tx) => {
      const item = await tx.billLineItem.create({
        data: { billId: bill.id, description, category: category || null, quantity: qty, unitPrice, totalPrice },
      })
      await tx.bill.update({ where: { id: bill.id }, data: { totalAmount: { increment: totalPrice } } })
      return item
    })

    res.status(201).json({ success: true, data: lineItem })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /billing/{billId}/void:
 *   patch:
 *     summary: Void a bill
 *     description: Admin only. Marks a bill as voided — no further payments or charges can be added.
 *     tags: [Billing]
 *     parameters:
 *       - in: path
 *         name: billId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Bill voided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Bill'
 *       403:
 *         description: Admin role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Bill not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:billId/void', authorize('ADMIN'), async (req, res, next) => {
  try {
    const bill = await prisma.bill.update({ where: { id: req.params.billId }, data: { status: 'VOIDED' } })
    await logActivity({
      actionType: 'BILL_VOIDED', entityType: 'BILL',
      entityId: bill.id, staffId: req.staff!.staffId,
    })
    res.json({ success: true, data: bill })
  } catch (err) { next(err) }
})

export default router