import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { AppError } from '../../shared/middleware/errorHandler'
import prisma from '../../shared/db/prisma'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Stays
 *   description: Active guest stays — check-in and check-out
 */

/**
 * @swagger
 * /stays:
 *   get:
 *     summary: List all active stays (guests currently in-house)
 *     tags: [Stays]
 *     responses:
 *       200:
 *         description: Array of active stays with guest, room, and reservation
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Stay'
 *                       - type: object
 *                         properties:
 *                           guest:
 *                             $ref: '#/components/schemas/Guest'
 *                           room:
 *                             $ref: '#/components/schemas/Room'
 */
router.get('/', async (_req, res, next) => {
  try {
    const stays = await prisma.stay.findMany({
      where: { checkOutAt: null },
      include: { guest: true, room: true, reservation: true },
      orderBy: { checkInAt: 'desc' },
    })
    res.json({ success: true, data: stays })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /stays/{id}:
 *   get:
 *     summary: Get a stay by ID including bill
 *     tags: [Stays]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Stay with guest, room, and full bill details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Stay'
 *                     - type: object
 *                       properties:
 *                         guest:
 *                           $ref: '#/components/schemas/Guest'
 *                         room:
 *                           $ref: '#/components/schemas/Room'
 *                         bill:
 *                           $ref: '#/components/schemas/Bill'
 *       404:
 *         description: Stay not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res, next) => {
  try {
    const stay = await prisma.stay.findUnique({
      where: { id: req.params.id },
      include: {
        guest: true, room: true,
        bill: { include: { payments: true, lineItems: true } },
      },
    })
    if (!stay) throw new AppError(404, 'Stay not found', 'NOT_FOUND')
    res.json({ success: true, data: stay })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /stays/check-in:
 *   post:
 *     summary: Check in a guest
 *     description: |
 *       Creates a Stay record and opens a Bill automatically in a single transaction.
 *       Room status is updated to OCCUPIED.
 *       Reservation status is updated to CHECKED_IN.
 *     tags: [Stays]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckInRequest'
 *     responses:
 *       201:
 *         description: Check-in successful — returns stay and bill
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
 *                     stay:
 *                       $ref: '#/components/schemas/Stay'
 *                     bill:
 *                       $ref: '#/components/schemas/Bill'
 *       400:
 *         description: Cannot check in — reservation cancelled or invalid state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Guest already checked in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/check-in', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const { reservationId } = req.body
    if (!reservationId) throw new AppError(400, 'reservationId is required', 'VALIDATION')

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { room: true },
    })
    if (!reservation) throw new AppError(404, 'Reservation not found', 'NOT_FOUND')
    if (reservation.status === 'CHECKED_IN') throw new AppError(409, 'Guest is already checked in', 'CONFLICT')
    if (reservation.status === 'CANCELLED') throw new AppError(400, 'Cannot check in a cancelled reservation', 'INVALID_STATE')

    const nights = Math.ceil(
      (reservation.checkOutDate.getTime() - reservation.checkInDate.getTime()) / 86400000
    )

    const { stay, bill } = await prisma.$transaction(async (tx) => {
      const stay = await tx.stay.create({
        data: {
          reservationId,
          guestId: reservation.guestId,
          roomId: reservation.roomId,
          checkInById: req.staff!.staffId,
        },
      })
      const bill = await tx.bill.create({
        data: {
          stayId: stay.id,
          totalAmount: reservation.totalAmount,
          createdById: req.staff!.staffId,
          lineItems: {
            create: {
              description: `Room ${reservation.room.roomNumber} — ${nights} night(s)`,
              quantity: 1,
              unitPrice: reservation.totalAmount,
              totalPrice: reservation.totalAmount,
            },
          },
        },
      })
      await tx.reservation.update({ where: { id: reservationId }, data: { status: 'CHECKED_IN' } })
      await tx.room.update({ where: { id: reservation.roomId }, data: { status: 'OCCUPIED' } })
      return { stay, bill }
    })

    await logActivity({
      actionType: 'CHECK_IN', entityType: 'STAY',
      entityId: stay.id, staffId: req.staff!.staffId,
      metadata: { reservationId, roomId: reservation.roomId, guestId: reservation.guestId },
    })

    res.status(201).json({ success: true, data: { stay, bill } })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /stays/{id}/check-out:
 *   post:
 *     summary: Check out a guest
 *     description: |
 *       Bill must be fully PAID before check-out is allowed.
 *       Room status is automatically set to CLEANING after check-out.
 *       Reservation status is updated to CHECKED_OUT.
 *     tags: [Stays]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Check-out successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Check-out successful. Room set to CLEANING.
 *       400:
 *         description: Bill must be fully paid before check-out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Stay not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Guest already checked out
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/check-out', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const stay = await prisma.stay.findUnique({
      where: { id: req.params.id },
      include: { bill: true },
    })
    if (!stay) throw new AppError(404, 'Stay not found', 'NOT_FOUND')
    if (stay.checkOutAt) throw new AppError(409, 'Guest already checked out', 'CONFLICT')
    if (stay.bill?.status === 'OPEN' || stay.bill?.status === 'PARTIAL') {
      throw new AppError(400, 'Bill must be fully paid before check-out', 'UNPAID_BILL')
    }

    await prisma.$transaction(async (tx) => {
      await tx.stay.update({
        where: { id: stay.id },
        data: { checkOutAt: new Date(), checkOutById: req.staff!.staffId },
      })
      await tx.reservation.update({ where: { id: stay.reservationId }, data: { status: 'CHECKED_OUT' } })
      await tx.room.update({ where: { id: stay.roomId }, data: { status: 'CLEANING' } })
    })

    await logActivity({
      actionType: 'CHECK_OUT', entityType: 'STAY',
      entityId: stay.id, staffId: req.staff!.staffId,
    })

    res.json({ success: true, message: 'Check-out successful. Room set to CLEANING.' })
  } catch (err) { next(err) }
})

export default router