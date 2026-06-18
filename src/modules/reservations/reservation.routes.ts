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
 *   name: Reservations
 *   description: Room reservations and availability
 */

/**
 * @swagger
 * /reservations:
 *   get:
 *     summary: List all reservations
 *     tags: [Reservations]
 *     responses:
 *       200:
 *         description: Array of reservations with guest and room details
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
 *                       - $ref: '#/components/schemas/Reservation'
 *                       - type: object
 *                         properties:
 *                           guest:
 *                             $ref: '#/components/schemas/Guest'
 *                           room:
 *                             $ref: '#/components/schemas/Room'
 */
router.get('/', async (_req, res, next) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: { guest: true, room: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ success: true, data: reservations })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reservations/{id}:
 *   get:
 *     summary: Get a reservation by ID
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reservation with guest, room, and stay details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Reservation'
 *                     - type: object
 *                       properties:
 *                         guest:
 *                           $ref: '#/components/schemas/Guest'
 *                         room:
 *                           $ref: '#/components/schemas/Room'
 *                         stay:
 *                           $ref: '#/components/schemas/Stay'
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: req.params.id },
      include: { guest: true, room: true, stay: true },
    })
    if (!reservation) throw new AppError(404, 'Reservation not found', 'NOT_FOUND')
    res.json({ success: true, data: reservation })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reservations:
 *   post:
 *     summary: Create a new reservation
 *     description: |
 *       Checks room availability for the requested date range.
 *       Total amount is auto-calculated from room base price × nights.
 *     tags: [Reservations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateReservationRequest'
 *     responses:
 *       201:
 *         description: Reservation created with status CONFIRMED
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Reservation'
 *                     - type: object
 *                       properties:
 *                         guest:
 *                           $ref: '#/components/schemas/Guest'
 *                         room:
 *                           $ref: '#/components/schemas/Room'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Room not available for selected dates
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const { guestId, roomId, checkInDate, checkOutDate, adults, children, notes, amount, status } = req.body
    if (!guestId || !roomId || !checkInDate || !checkOutDate) {
      throw new AppError(400, 'guestId, roomId, checkInDate, and checkOutDate are required', 'VALIDATION')
    }

    const conflict = await prisma.reservation.findFirst({
      where: {
        roomId,
        status: { in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
        AND: [
          { checkInDate: { lt: new Date(checkOutDate) } },
          { checkOutDate: { gt: new Date(checkInDate) } },
        ],
      },
    })
    if (conflict) throw new AppError(409, 'Room is not available for the selected dates', 'ROOM_CONFLICT')

    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) throw new AppError(404, 'Room not found', 'NOT_FOUND')

    let totalAmount: number
    if (amount !== undefined) {
      totalAmount = Number(amount)
    } else {
      const nights = Math.ceil(
        (new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / (1000 * 60 * 60 * 24)
      )
      totalAmount = Number(room.basePrice) * nights
    }

    let reservationStatus = status || 'CONFIRMED'
    if (reservationStatus === 'Pending') reservationStatus = 'PENDING'
    else if (reservationStatus === 'Paid' || reservationStatus === 'Part Paid') reservationStatus = 'CONFIRMED'
    else if (reservationStatus === 'Checked In') reservationStatus = 'CHECKED_IN'

    const reservation = await prisma.reservation.create({
      data: {
        guestId, roomId,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        adults: adults ?? 1,
        children: children ?? 0,
        totalAmount, notes,
        status: reservationStatus as any,
        createdById: req.staff!.staffId,
      },
      include: { guest: true, room: true },
    })

    await logActivity({
      actionType: 'RESERVATION_CREATED', entityType: 'RESERVATION',
      entityId: reservation.id, staffId: req.staff!.staffId,
      metadata: { guestId, roomId, checkInDate, checkOutDate, totalAmount },
    })

    res.status(201).json({ success: true, data: reservation })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reservations/{id}/cancel:
 *   patch:
 *     summary: Cancel a reservation
 *     tags: [Reservations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reservation cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id/cancel', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const reservation = await prisma.reservation.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
    })
    await logActivity({
      actionType: 'RESERVATION_CANCELLED', entityType: 'RESERVATION',
      entityId: reservation.id, staffId: req.staff!.staffId,
    })
    res.json({ success: true, data: reservation })
  } catch (err) { next(err) }
})

export default router