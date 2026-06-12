import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { AppError } from '../../shared/middleware/errorHandler'
import * as kitchenService from './kitchen.service'
import { KitchenItemStatus, KitchenTicketStatus } from '@prisma/client'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Kitchen
 *   description: Kitchen Display System — ticket queue and item status tracking
 */

/**
 * @swagger
 * /kitchen/tickets:
 *   get:
 *     summary: Get kitchen ticket queue
 *     description: |
 *       Returns tickets ordered oldest first (FIFO). Filter by status to show only active tickets on the KDS.
 *       Kitchen staff only sees item names, quantities, notes, and timers — never prices.
 *     tags: [Kitchen]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/KitchenTicketStatus'
 *     responses:
 *       200:
 *         description: Array of kitchen tickets
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
 *                     $ref: '#/components/schemas/KitchenTicket'
 */
router.get('/tickets', authorize('ADMIN', 'MANAGER', 'KITCHEN'), async (req, res, next) => {
  try {
    const { status } = req.query as { status?: KitchenTicketStatus }
    const tickets = await kitchenService.getTickets({ status })
    res.json({ success: true, data: tickets })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /kitchen/tickets/{id}:
 *   get:
 *     summary: Get a kitchen ticket by ID
 *     tags: [Kitchen]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ticket with all items and order context
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/KitchenTicket'
 *       404:
 *         description: Ticket not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/tickets/:id', authorize('ADMIN', 'MANAGER', 'KITCHEN'), async (req, res, next) => {
  try {
    const ticket = await kitchenService.getTicketById(req.params.id)
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /kitchen/tickets/{ticketId}/items/{itemId}/status:
 *   patch:
 *     summary: Update a single item status on a ticket
 *     description: |
 *       Item status flow: QUEUED → PREPARING → COOKING → DONE
 *       Ticket status auto-updates based on all item statuses:
 *       - Any item PREPARING/COOKING → ticket becomes IN_PROGRESS
 *       - All items DONE → ticket becomes READY
 *     tags: [Kitchen]
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateKitchenItemStatusRequest'
 *     responses:
 *       200:
 *         description: Item status updated, ticket status auto-synced
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/KitchenTicketItem'
 *       404:
 *         description: Ticket or item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/tickets/:ticketId/items/:itemId/status', authorize('ADMIN', 'MANAGER', 'KITCHEN'), async (req, res, next) => {
  try {
    const { status, assignedTo, shiftId } = req.body
    if (!status || !Object.values(KitchenItemStatus).includes(status)) {
      throw new AppError(400, `status must be one of: ${Object.values(KitchenItemStatus).join(', ')}`, 'VALIDATION')
    }
    const item = await kitchenService.updateItemStatus(
      req.params.ticketId,
      req.params.itemId,
      status,
      req.staff!.staffId,
      shiftId,
      assignedTo
    )
    res.json({ success: true, data: item })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /kitchen/tickets/{id}/ready:
 *   post:
 *     summary: Mark all items on a ticket as ready
 *     description: |
 *       Shortcut to mark all pending items as DONE and set ticket to READY.
 *       Used when chef taps "Mark Ready" for the whole order at once.
 *       POS staff are notified to collect and deliver.
 *     tags: [Kitchen]
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
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Ticket marked as READY
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/KitchenTicket'
 */
router.post('/tickets/:id/ready', authorize('ADMIN', 'MANAGER', 'KITCHEN'), async (req, res, next) => {
  try {
    const ticket = await kitchenService.markTicketReady(
      req.params.id, req.staff!.staffId, req.body.shiftId
    )
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /kitchen/tickets/{id}/complete:
 *   post:
 *     summary: Complete a kitchen ticket
 *     description: |
 *       Called after food is delivered to table or room.
 *       Automatically deducts kitchen ingredient stock for all food items.
 *       Ticket must be in READY status.
 *     tags: [Kitchen]
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
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Ticket completed, kitchen stock deducted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/KitchenTicket'
 *       400:
 *         description: Ticket must be READY before completing
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/tickets/:id/complete', authorize('ADMIN', 'MANAGER', 'KITCHEN'), async (req, res, next) => {
  try {
    const ticket = await kitchenService.completeTicket(
      req.params.id, req.staff!.staffId, req.body.shiftId
    )
    res.json({ success: true, data: ticket })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /kitchen/tickets/{id}/cancel:
 *   post:
 *     summary: Cancel a kitchen ticket
 *     description: |
 *       If any items were already in PREPARING/COOKING/DONE status,
 *       a waste log entry is automatically created for each one.
 *       This ensures food waste is always tracked and auditable.
 *     tags: [Kitchen]
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
 *               reason:
 *                 type: string
 *                 example: Guest cancelled order
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Ticket cancelled — waste logs created for started items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     ticketId:
 *                       type: string
 *                       format: uuid
 *                     wasteLogsCreated:
 *                       type: integer
 *                       example: 2
 */
router.post('/tickets/:id/cancel', authorize('ADMIN', 'MANAGER', 'KITCHEN'), async (req, res, next) => {
  try {
    const { reason, shiftId } = req.body
    const result = await kitchenService.cancelTicket(
      req.params.id, req.staff!.staffId, shiftId, reason
    )
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

export default router