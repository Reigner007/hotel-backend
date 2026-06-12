import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { AppError } from '../../shared/middleware/errorHandler'
import prisma from '../../shared/db/prisma'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Shifts
 *   description: Shift definitions, assignments, and logs
 */

/**
 * @swagger
 * /shifts:
 *   get:
 *     summary: List all shift definitions
 *     tags: [Shifts]
 *     responses:
 *       200:
 *         description: Array of shifts
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
 *                     $ref: '#/components/schemas/Shift'
 */
router.get('/', async (_req, res, next) => {
  try {
    const shifts = await prisma.shift.findMany({ orderBy: { name: 'asc' } })
    res.json({ success: true, data: shifts })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /shifts:
 *   post:
 *     summary: Create a shift definition
 *     description: Admin only.
 *     tags: [Shifts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShiftRequest'
 *     responses:
 *       201:
 *         description: Shift created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Shift'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { name, startTime, endTime } = req.body
    if (!name || !startTime || !endTime) {
      throw new AppError(400, 'name, startTime, and endTime are required', 'VALIDATION')
    }
    const shift = await prisma.shift.create({ data: { name, startTime, endTime } })
    res.status(201).json({ success: true, data: shift })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /shifts/assign:
 *   post:
 *     summary: Assign a staff member to a shift on a specific date
 *     description: Admin or Manager only. One assignment per staff member per day.
 *     tags: [Shifts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignShiftRequest'
 *     responses:
 *       201:
 *         description: Shift assigned
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
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     staffId:
 *                       type: string
 *                       format: uuid
 *                     shiftId:
 *                       type: string
 *                       format: uuid
 *                     date:
 *                       type: string
 *                       format: date
 *       409:
 *         description: Staff already has a shift assigned on this date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/assign', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { staffId, shiftId, date } = req.body
    if (!staffId || !shiftId || !date) {
      throw new AppError(400, 'staffId, shiftId, and date are required', 'VALIDATION')
    }
    const assignment = await prisma.staffShift.create({
      data: { staffId, shiftId, date: new Date(date) },
    })
    res.status(201).json({ success: true, data: assignment })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /shifts/logs:
 *   get:
 *     summary: Get shift logs (login/logout times per staff per shift)
 *     description: Returns last 100 shift log entries. Admin and Manager only.
 *     tags: [Shifts]
 *     responses:
 *       200:
 *         description: Shift log entries
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       loginTime:
 *                         type: string
 *                         format: date-time
 *                       logoutTime:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                       staff:
 *                         type: object
 *                         properties:
 *                           fullName:
 *                             type: string
 *                           username:
 *                             type: string
 *                       shift:
 *                         $ref: '#/components/schemas/Shift'
 */
router.get('/logs', authorize('ADMIN', 'MANAGER'), async (_req, res, next) => {
  try {
    const logs = await prisma.shiftLog.findMany({
      include: {
        staff: { select: { fullName: true, username: true } },
        shift: true,
      },
      orderBy: { loginTime: 'desc' },
      take: 100,
    })
    res.json({ success: true, data: logs })
  } catch (err) { next(err) }
})

export default router