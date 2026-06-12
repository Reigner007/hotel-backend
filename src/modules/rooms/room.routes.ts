import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { logActivity } from '../../core/activity-logs/activityLog.service'
import { AppError } from '../../shared/middleware/errorHandler'
import prisma from '../../shared/db/prisma'
import { RoomStatus } from '@prisma/client'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Rooms
 *   description: Room inventory and status management
 */

/**
 * @swagger
 * /rooms:
 *   get:
 *     summary: List all rooms
 *     tags: [Rooms]
 *     responses:
 *       200:
 *         description: Array of rooms
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
 *                     $ref: '#/components/schemas/Room'
 */
router.get('/', async (_req, res, next) => {
  try {
    const rooms = await prisma.room.findMany({ orderBy: { roomNumber: 'asc' } })
    res.json({ success: true, data: rooms })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /rooms/{id}:
 *   get:
 *     summary: Get a room by ID
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Room details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res, next) => {
  try {
    const room = await prisma.room.findUnique({ where: { id: req.params.id } })
    if (!room) throw new AppError(404, 'Room not found', 'NOT_FOUND')
    res.json({ success: true, data: room })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /rooms:
 *   post:
 *     summary: Create a new room
 *     description: Admin or Manager only.
 *     tags: [Rooms]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRoomRequest'
 *     responses:
 *       201:
 *         description: Room created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       409:
 *         description: Room number already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { roomNumber, floor, type, basePrice, description } = req.body
    if (!roomNumber || floor === undefined || !type || basePrice === undefined) {
      throw new AppError(400, 'roomNumber, floor, type, and basePrice are required', 'VALIDATION')
    }
    const room = await prisma.room.create({ data: { roomNumber, floor, type, basePrice, description } })
    await logActivity({
      actionType: 'ROOM_CREATED', entityType: 'ROOM',
      entityId: room.id, staffId: req.staff!.staffId,
    })
    res.status(201).json({ success: true, data: room })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /rooms/{id}/status:
 *   patch:
 *     summary: Update room status
 *     description: Used by front desk and housekeeping to transition room states.
 *     tags: [Rooms]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRoomStatusRequest'
 *     responses:
 *       200:
 *         description: Room status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Room'
 *       400:
 *         description: Invalid status value
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Room not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id/status', authorize('ADMIN', 'MANAGER', 'FRONT_DESK', 'HOUSEKEEPING'), async (req, res, next) => {
  try {
    const { status } = req.body
    if (!Object.values(RoomStatus).includes(status)) {
      throw new AppError(400, `status must be one of: ${Object.values(RoomStatus).join(', ')}`, 'VALIDATION')
    }
    const room = await prisma.room.update({ where: { id: req.params.id }, data: { status } })
    await logActivity({
      actionType: 'ROOM_STATUS_CHANGED', entityType: 'ROOM',
      entityId: room.id, staffId: req.staff!.staffId,
      metadata: { status },
    })
    res.json({ success: true, data: room })
  } catch (err) { next(err) }
})

export default router