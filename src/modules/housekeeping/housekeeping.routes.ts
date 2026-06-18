import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { AppError } from '../../shared/middleware/errorHandler'
import * as housekeepingService from './housekeeping.service'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Housekeeping
 *   description: Room cleaning workflow and item usage tracking
 */

/**
 * @swagger
 * /housekeeping:
 *   get:
 *     summary: List housekeeping logs
 *     description: Filterable by room, staff, or active sessions only.
 *     tags: [Housekeeping]
 *     parameters:
 *       - in: query
 *         name: roomId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: If true, returns only in-progress sessions
 *     responses:
 *       200:
 *         description: Array of housekeeping logs with room and usage details
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
 *                     $ref: '#/components/schemas/HousekeepingLog'
 */
router.get('/', authorize('ADMIN', 'MANAGER', 'HOUSEKEEPING'), async (req, res, next) => {
  try {
    const { roomId, staffId, active } = req.query as Record<string, string>
    const logs = await housekeepingService.getLogs({
      roomId,
      staffId,
      active: active === 'true',
    })
    res.json({ success: true, data: logs })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /housekeeping/{id}:
 *   get:
 *     summary: Get a housekeeping log by ID
 *     tags: [Housekeeping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Housekeeping log with room and all item usages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/HousekeepingLog'
 *       404:
 *         description: Log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authorize('ADMIN', 'MANAGER', 'HOUSEKEEPING'), async (req, res, next) => {
  try {
    const log = await housekeepingService.getLogById(req.params.id)
    res.json({ success: true, data: log })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /housekeeping/start:
 *   post:
 *     summary: Start a cleaning session for a room
 *     description: |
 *       Room must be in CLEANING status (set automatically on guest check-out).
 *       Only one active cleaning session allowed per room at a time.
 *     tags: [Housekeeping]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StartCleaningRequest'
 *     responses:
 *       201:
 *         description: Cleaning session started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/HousekeepingLog'
 *       400:
 *         description: Room not in CLEANING status
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Active cleaning session already exists for this room
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/start', authorize('ADMIN', 'MANAGER', 'HOUSEKEEPING'), async (req, res, next) => {
  try {
    const { roomId, roomNumber, shiftId, notes } = req.body
    if (!roomId && !roomNumber) throw new AppError(400, 'roomId or roomNumber is required', 'VALIDATION')
    const log = await housekeepingService.startCleaning({
      roomId,
      roomNumber,
      staffId: req.staff!.staffId,
      shiftId,
      notes,
    })
    res.status(201).json({ success: true, data: log })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /housekeeping/{id}/complete:
 *   post:
 *     summary: Complete a cleaning session
 *     description: |
 *       Marks the cleaning session as done and automatically sets the room status to AVAILABLE.
 *     tags: [Housekeeping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 example: Deep cleaned. Replaced all towels and toiletries.
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Cleaning completed — room set to AVAILABLE
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/HousekeepingLog'
 *       404:
 *         description: Log not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Session already completed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/complete', authorize('ADMIN', 'MANAGER', 'HOUSEKEEPING'), async (req, res, next) => {
  try {
    const { notes, shiftId } = req.body
    const log = await housekeepingService.completeCleaning(
      req.params.id,
      req.staff!.staffId,
      shiftId,
      notes
    )
    res.json({ success: true, data: log })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /housekeeping/{id}/usage:
 *   post:
 *     summary: Record items used during a cleaning session
 *     description: |
 *       Links item consumption to a housekeeping log.
 *       Automatically records a USAGE stock movement for each item — reducing inventory.
 *       Can be called multiple times during an active session.
 *     tags: [Housekeeping]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Housekeeping log ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RecordUsageRequest'
 *     responses:
 *       201:
 *         description: Usage recorded and stock updated
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
 *                     $ref: '#/components/schemas/HousekeepingUsage'
 *       400:
 *         description: Cannot record usage on a completed session or insufficient stock
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Log or item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/usage', authorize('ADMIN', 'MANAGER', 'HOUSEKEEPING'), async (req, res, next) => {
  try {
    const { items, shiftId } = req.body
    if (!items?.length) throw new AppError(400, 'items array is required and must not be empty', 'VALIDATION')
    const usages = await housekeepingService.recordUsage({
      housekeepingLogId: req.params.id,
      items,
      staffId: req.staff!.staffId,
      shiftId,
    })
    res.status(201).json({ success: true, data: usages })
  } catch (err) { next(err) }
})

export default router