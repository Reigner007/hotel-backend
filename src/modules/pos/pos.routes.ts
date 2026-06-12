import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { AppError } from '../../shared/middleware/errorHandler'
import * as posProductService from './posProduct.service'
import * as posService from './pos.service'
import { ProductType } from '@prisma/client'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: POS - Products
 *   description: Menu/product catalogue shared between POS and Kitchen
 */

/**
 * @swagger
 * /pos/products:
 *   get:
 *     summary: List all products
 *     description: Filterable by type (FOOD/BEVERAGE) and availability. This is the live menu shown at POS terminals and on the KDS.
 *     tags: [POS - Products]
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/ProductType'
 *       - in: query
 *         name: isAvailable
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Product list
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
 *                     $ref: '#/components/schemas/PosProduct'
 */
router.get('/products', async (req, res, next) => {
  try {
    const { type, isAvailable } = req.query as Record<string, string>
    const products = await posProductService.getAllProducts({
      type: type as ProductType,
      isAvailable: isAvailable !== undefined ? isAvailable === 'true' : undefined,
    })
    res.json({ success: true, data: products })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/products/{id}:
 *   get:
 *     summary: Get a product by ID
 *     tags: [POS - Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PosProduct'
 *       404:
 *         description: Product not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await posProductService.getProductById(req.params.id)
    res.json({ success: true, data: product })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/products:
 *   post:
 *     summary: Create a new menu product
 *     description: Admin or Manager only. Set type to FOOD to route to kitchen, BEVERAGE for direct bar stock deduction.
 *     tags: [POS - Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePosProductRequest'
 *     responses:
 *       201:
 *         description: Product created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PosProduct'
 */
router.post('/products', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { name, type, price, categoryId, linkedInventoryItemId, description } = req.body
    if (!name || !type || price === undefined) {
      throw new AppError(400, 'name, type, and price are required', 'VALIDATION')
    }
    if (!Object.values(ProductType).includes(type)) {
      throw new AppError(400, `type must be FOOD or BEVERAGE`, 'VALIDATION')
    }
    const product = await posProductService.createProduct({
      name, type, price: Number(price), categoryId, linkedInventoryItemId, description,
    })
    res.status(201).json({ success: true, data: product })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/products/{id}:
 *   patch:
 *     summary: Update a product
 *     description: Admin or Manager only. Does not change product type — create a new product instead.
 *     tags: [POS - Products]
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
 *             $ref: '#/components/schemas/UpdatePosProductRequest'
 *     responses:
 *       200:
 *         description: Product updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PosProduct'
 */
router.patch('/products/:id', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { name, price, categoryId, linkedInventoryItemId, description } = req.body
    const product = await posProductService.updateProduct(req.params.id, {
      name, price: price !== undefined ? Number(price) : undefined,
      categoryId, linkedInventoryItemId, description,
    })
    res.json({ success: true, data: product })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/products/{id}/availability:
 *   patch:
 *     summary: Toggle product availability
 *     description: |
 *       When set to unavailable, the product is hidden from the POS terminal and the KDS simultaneously.
 *       Kitchen can mark items unavailable when an ingredient runs out.
 *     tags: [POS - Products]
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
 *             type: object
 *             required: [isAvailable]
 *             properties:
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Availability updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PosProduct'
 */
router.patch('/products/:id/availability', authorize('ADMIN', 'MANAGER', 'KITCHEN'), async (req, res, next) => {
  try {
    const { isAvailable } = req.body
    if (typeof isAvailable !== 'boolean') {
      throw new AppError(400, 'isAvailable must be true or false', 'VALIDATION')
    }
    const product = await posProductService.setAvailability(req.params.id, isAvailable)
    res.json({ success: true, data: product })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * tags:
 *   name: POS - Orders
 *   description: POS order creation, charging, and completion
 */

/**
 * @swagger
 * /pos/orders:
 *   get:
 *     summary: List POS orders
 *     description: Filterable by status, type, staff, or date.
 *     tags: [POS - Orders]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/PosOrderStatus'
 *       - in: query
 *         name: type
 *         schema:
 *           $ref: '#/components/schemas/OrderType'
 *       - in: query
 *         name: staffId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by specific date (YYYY-MM-DD)
 *     responses:
 *       200:
 *         description: Array of POS orders
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
 *                     $ref: '#/components/schemas/PosOrder'
 */
router.get('/orders', async (req, res, next) => {
  try {
    const { status, type, staffId, date } = req.query as Record<string, string>
    const orders = await posService.getOrders({ status, type, staffId, date })
    res.json({ success: true, data: orders })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/orders/{id}:
 *   get:
 *     summary: Get a POS order by ID
 *     tags: [POS - Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Full order with items, payments, and kitchen ticket
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PosOrder'
 *       404:
 *         description: Order not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await posService.getOrderById(req.params.id)
    res.json({ success: true, data: order })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/orders:
 *   post:
 *     summary: Create a new POS order
 *     description: |
 *       Builds the order cart. Does not charge yet — call POST /pos/orders/{id}/charge to process payment.
 *       - DINE_IN requires tableRef
 *       - ROOM_SERVICE requires roomId
 *       - TAKEAWAY requires neither
 *     tags: [POS - Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePosOrderRequest'
 *     responses:
 *       201:
 *         description: Order created with status OPEN
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PosOrder'
 *       400:
 *         description: Validation error or unavailable product
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/orders', async (req, res, next) => {
  try {
    const { type, tableRef, roomId, note, shiftId, items } = req.body
    if (!type || !items) throw new AppError(400, 'type and items are required', 'VALIDATION')
    const order = await posService.createOrder({
      type, tableRef, roomId, note, shiftId,
      staffId: req.staff!.staffId,
      items,
    })
    res.status(201).json({ success: true, data: order })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/orders/{id}/charge:
 *   post:
 *     summary: Charge a POS order
 *     description: |
 *       Processes payment for an open order. On charge:
 *       - Payments are recorded
 *       - POST_TO_ROOM adds a line item to the guest's active bill
 *       - Food items are automatically sent to the kitchen as a ticket
 *       - Beverage items immediately deduct bar stock
 *       - Supports split payment (multiple payment entries that sum to order total)
 *       - STAFF_MEAL should use COMPLIMENTARY payment method
 *     tags: [POS - Orders]
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
 *             $ref: '#/components/schemas/ChargeOrderRequest'
 *     responses:
 *       200:
 *         description: Order charged — status updated to CHARGED, kitchen ticket created for food items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PosOrder'
 *       400:
 *         description: Payment total mismatch or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Order already charged or voided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/orders/:id/charge', async (req, res, next) => {
  try {
    const { payments, shiftId } = req.body
    if (!payments?.length) throw new AppError(400, 'payments array is required', 'VALIDATION')
    const order = await posService.chargeOrder(
      req.params.id, payments,
      req.staff!.staffId, shiftId
    )
    res.json({ success: true, data: order })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/orders/{id}/complete:
 *   post:
 *     summary: Mark an order as completed
 *     description: Called by waiter after delivering food/drinks to the table or room.
 *     tags: [POS - Orders]
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
 *         description: Order completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PosOrder'
 */
router.post('/orders/:id/complete', async (req, res, next) => {
  try {
    const order = await posService.completeOrder(
      req.params.id, req.staff!.staffId, req.body.shiftId
    )
    res.json({ success: true, data: order })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /pos/orders/{id}/void:
 *   post:
 *     summary: Void a POS order
 *     description: Manager or Admin only. Requires a void reason. Cannot void a completed order.
 *     tags: [POS - Orders]
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
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Customer changed mind
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Order voided
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
 *                   example: Order voided successfully
 *       400:
 *         description: Cannot void a completed order
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/orders/:id/void', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { reason, shiftId } = req.body
    await posService.voidOrder(req.params.id, req.staff!.staffId, shiftId, reason)
    res.json({ success: true, message: 'Order voided successfully' })
  } catch (err) { next(err) }
})

export default router