import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { AppError } from '../../shared/middleware/errorHandler'
import * as stockService from './stock.service'
import { Department, StockMovementType } from '@prisma/client'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Stock
 *   description: Stock movements — the auditable inventory ledger
 */

/**
 * @swagger
 * /stock/movements:
 *   get:
 *     summary: Get stock movement history
 *     description: Store manager and admin can see all movements. Filterable by item, type, department, and date range.
 *     tags: [Stock]
 *     parameters:
 *       - in: query
 *         name: itemId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/StockMovementType'
 *       - in: query
 *         name: department
 *         schema:
 *           $ref: '#/components/schemas/Department'
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (inclusive)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (inclusive)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Array of stock movements
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
 *                     $ref: '#/components/schemas/StockMovement'
 */
router.get('/movements', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { itemId, type, department, from, to, limit } = req.query as Record<string, string>
    const movements = await stockService.getMovements({
      itemId,
      type: type as StockMovementType,
      department: department as Department,
      from,
      to,
      limit: limit ? parseInt(limit) : undefined,
    })
    res.json({ success: true, data: movements })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /stock/receive:
 *   post:
 *     summary: Receive stock into the store (IN)
 *     description: |
 *       Records an IN movement — stock arriving from a supplier.
 *       Only store staff, manager, or admin can receive stock.
 *       Automatically updates item quantity and recalculates status.
 *     tags: [Stock]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ReceiveStockRequest'
 *     responses:
 *       201:
 *         description: Stock received and quantity updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StockMovementResult'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/receive', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { itemId, quantity, note, shiftId } = req.body
    if (!itemId || !quantity) throw new AppError(400, 'itemId and quantity are required', 'VALIDATION')
    if (quantity <= 0) throw new AppError(400, 'quantity must be greater than 0', 'VALIDATION')

    const result = await stockService.recordMovement({
      itemId, quantity: Number(quantity),
      type: 'IN',
      department: 'STORE',
      staffId: req.staff!.staffId,
      shiftId, note,
    })
    res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /stock/adjust:
 *   post:
 *     summary: Manual stock adjustment
 *     description: |
 *       Used for corrections after physical stock count.
 *       Records an ADJUSTMENT movement. Admin and store manager only.
 *       Can only reduce quantity — use /receive for increases.
 *     tags: [Stock]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdjustStockRequest'
 *     responses:
 *       201:
 *         description: Adjustment recorded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StockMovementResult'
 *       400:
 *         description: Insufficient stock or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/adjust', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { itemId, quantity, note, shiftId } = req.body
    if (!itemId || !quantity) throw new AppError(400, 'itemId and quantity are required', 'VALIDATION')
    if (!note) throw new AppError(400, 'note is required for adjustments', 'VALIDATION')

    const result = await stockService.recordMovement({
      itemId, quantity: Number(quantity),
      type: 'ADJUSTMENT',
      department: 'STORE',
      staffId: req.staff!.staffId,
      shiftId, note,
    })
    res.status(201).json({ success: true, data: result })
  } catch (err) { next(err) }
})

export default router