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
    const guests = await prisma.guest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { stays: true } } },
    })
    const mapped = guests.map(g => ({
      id: g.id,
      name: g.name || g.fullName,
      fullName: g.fullName,
      phone: g.phone,
      email: g.email,
      idType: g.idType,
      idNumber: g.idNumber,
      nationality: g.nationality,
      address: g.address,
      status: g.status === 'CHECKOUT_TODAY' ? 'Checkout Today' as const : g.status === 'IN_HOUSE' ? 'In-House' as const : g.status === 'CHECKED_OUT' ? 'Checked Out' as const : 'Reserved' as const,
      notes: g.notes,
      avatarUrl: g.avatarUrl,
      idImage: g.idImage,
      lastStay: g.lastStay ? g.lastStay.toISOString().split('T')[0] : '-',
      totalVisits: g.totalVisits,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt,
    }))
    res.json({ success: true, data: mapped })
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
      include: { reservations: { take: 10, orderBy: { createdAt: 'desc' } }, _count: { select: { stays: true } } },
    })
    if (!guest) throw new AppError(404, 'Guest not found', 'NOT_FOUND')
    const mapped = {
      id: guest.id,
      name: guest.name || guest.fullName,
      fullName: guest.fullName,
      phone: guest.phone,
      email: guest.email,
      idType: guest.idType,
      idNumber: guest.idNumber,
      nationality: guest.nationality,
      address: guest.address,
      status: guest.status === 'CHECKOUT_TODAY' ? 'Checkout Today' : guest.status === 'IN_HOUSE' ? 'In-House' : guest.status === 'CHECKED_OUT' ? 'Checked Out' : 'Reserved',
      notes: guest.notes,
      avatarUrl: guest.avatarUrl,
      idImage: guest.idImage,
      lastStay: guest.lastStay ? guest.lastStay.toISOString().split('T')[0] : '-',
      totalVisits: guest.totalVisits,
      createdAt: guest.createdAt,
      updatedAt: guest.updatedAt,
      reservations: guest.reservations,
    }
    res.json({ success: true, data: mapped })
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
    const { fullName, name, phone, email, idType, idNumber, nationality, address, status, notes, avatarUrl, idImage } = req.body
    const guestName = name || fullName
    if (!guestName || !phone) throw new AppError(400, 'name/fullName and phone are required', 'VALIDATION')

    let guestStatus: string = 'RESERVED'
    if (status === 'In-House' || status === 'In House') guestStatus = 'IN_HOUSE'
    else if (status === 'Checked Out') guestStatus = 'CHECKED_OUT'
    else if (status === 'Checkout Today') guestStatus = 'CHECKOUT_TODAY'

    let idTypeVal = idType
    if (idType === 'National ID (NIN)') idTypeVal = 'NIN'
    else if (idType === "Driver's License") idTypeVal = 'DRIVERS_LICENSE'
    else if (idType === 'Passport') idTypeVal = 'PASSPORT'
    else if (idType === "Voter's Card") idTypeVal = 'VOTERS_CARD'

    const guest = await prisma.guest.create({
      data: {
        fullName: guestName,
        name: guestName,
        phone,
        email,
        idType: idTypeVal,
        idNumber,
        nationality,
        address,
        status: guestStatus as any,
        notes,
        avatarUrl,
        idImage,
        totalVisits: 1,
        lastStay: new Date(),
      },
    })
    await logActivity({
      actionType: 'GUEST_CREATED', entityType: 'GUEST',
      entityId: guest.id, staffId: req.staff!.staffId,
    })
    res.status(201).json({
      success: true,
      data: {
        id: guest.id,
        name: guest.name || guest.fullName,
        status: guest.status,
        fullName: guest.fullName,
        phone: guest.phone,
        idType: guest.idType,
      },
    })
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
    const { fullName, name, phone, email, idType, idNumber, nationality, address, status, notes, avatarUrl, idImage } = req.body
    const data: any = {}
    if (fullName !== undefined) data.fullName = fullName
    if (name !== undefined) data.name = name
    if (phone !== undefined) data.phone = phone
    if (email !== undefined) data.email = email
    if (idType !== undefined) {
      if (idType === 'National ID (NIN)') data.idType = 'NIN'
      else if (idType === "Driver's License") data.idType = 'DRIVERS_LICENSE'
      else if (idType === 'Passport') data.idType = 'PASSPORT'
      else if (idType === "Voter's Card") data.idType = 'VOTERS_CARD'
      else data.idType = idType
    }
    if (idNumber !== undefined) data.idNumber = idNumber
    if (nationality !== undefined) data.nationality = nationality
    if (address !== undefined) data.address = address
    if (status !== undefined) {
      if (status === 'In-House' || status === 'In House') data.status = 'IN_HOUSE'
      else if (status === 'Checked Out') data.status = 'CHECKED_OUT'
      else if (status === 'Checkout Today') data.status = 'CHECKOUT_TODAY'
      else if (status === 'Reserved') data.status = 'RESERVED'
    }
    if (notes !== undefined) data.notes = notes
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl
    if (idImage !== undefined) data.idImage = idImage

    const guest = await prisma.guest.update({
      where: { id: req.params.id },
      data,
    })
    await logActivity({
      actionType: 'GUEST_UPDATED', entityType: 'GUEST',
      entityId: guest.id, staffId: req.staff!.staffId,
    })
    res.json({
      success: true,
      data: {
        id: guest.id,
        name: guest.name || guest.fullName,
        fullName: guest.fullName,
        phone: guest.phone,
        idType: guest.idType,
        status: guest.status,
        notes: guest.notes,
        avatarUrl: guest.avatarUrl,
        idImage: guest.idImage,
      },
    })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /guests/{id}:
 *   delete:
 *     summary: Delete a guest profile
 *     description: Only Admin, Manager, or Front Desk. Blocks deletion if guest has active stays.
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
 *         description: Guest deleted
 *       400:
 *         description: Guest has active stays — cannot delete
 *       404:
 *         description: Guest not found
 */
router.delete('/:id', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (req, res, next) => {
  try {
    const guest = await prisma.guest.findUnique({ where: { id: req.params.id } })
    if (!guest) throw new AppError(404, 'Guest not found', 'NOT_FOUND')

    const activeStay = await prisma.stay.findFirst({
      where: { guestId: req.params.id, checkOutAt: null },
    })
    if (activeStay) throw new AppError(400, 'Cannot delete guest with active stays', 'INVALID_STATE')

    await prisma.guest.delete({ where: { id: req.params.id } })
    await logActivity({
      actionType: 'GUEST_DELETED', entityType: 'GUEST',
      entityId: req.params.id, staffId: req.staff!.staffId,
    })
    res.json({ success: true, message: 'Guest deleted' })
  } catch (err) { next(err) }
})

export default router