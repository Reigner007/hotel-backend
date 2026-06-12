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
 *   name: Guests
 *   description: Guest profiles and history
 */

/**
 * @swagger
 * /guests:
 *   get:
 *     summary: List all guests
 *     tags: [Guests]
 *     responses:
 *       200:
 *         description: Array of guests
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
 *                     $ref: '#/components/schemas/Guest'
 */
router.get('/', async (_req, res, next) => {
  try {
    const guests = await prisma.guest.findMany({ orderBy: { createdAt: 'desc' } })
    res.json({ success: true, data: guests })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /guests/{id}:
 *   get:
 *     summary: Get a guest by ID including reservation history
 *     tags: [Guests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Guest details with last 10 reservations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Guest'
 *                     - type: object
 *                       properties:
 *                         reservations:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Reservation'
 *       404:
 *         description: Guest not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', async (req, res, next) => {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: req.params.id },
      include: { reservations: { take: 10, orderBy: { createdAt: 'desc' } } },
    })
    if (!guest) throw new AppError(404, 'Guest not found', 'NOT_FOUND')
    res.json({ success: true, data: guest })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /guests:
 *   post:
 *     summary: Create a new guest profile
 *     description: Front desk, Manager, or Admin.
 *     tags: [Guests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGuestRequest'
 *     responses:
 *       201:
 *         description: Guest created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Guest'
 *       400:
 *         description: fullName and phone are required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const { fullName, phone, email, idType, idNumber, nationality, address } = req.body
    if (!fullName || !phone) throw new AppError(400, 'fullName and phone are required', 'VALIDATION')
    const guest = await prisma.guest.create({
      data: { fullName, phone, email, idType, idNumber, nationality, address },
    })
    await logActivity({
      actionType: 'GUEST_CREATED', entityType: 'GUEST',
      entityId: guest.id, staffId: req.staff!.staffId,
    })
    res.status(201).json({ success: true, data: guest })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /guests/{id}:
 *   patch:
 *     summary: Update guest profile
 *     tags: [Guests]
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
 *             $ref: '#/components/schemas/CreateGuestRequest'
 *     responses:
 *       200:
 *         description: Guest updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Guest'
 *       404:
 *         description: Guest not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/:id', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const { fullName, phone, email, idType, idNumber, nationality, address } = req.body
    const guest = await prisma.guest.update({
      where: { id: req.params.id },
      data: { fullName, phone, email, idType, idNumber, nationality, address },
    })
    await logActivity({
      actionType: 'GUEST_UPDATED', entityType: 'GUEST',
      entityId: guest.id, staffId: req.staff!.staffId,
    })
    res.json({ success: true, data: guest })
  } catch (err) { next(err) }
})

export default router