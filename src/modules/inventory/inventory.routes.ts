import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import * as inventoryService from './inventory.service'
import { AppError } from '../../shared/middleware/errorHandler'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Inventory
 *   description: Central store inventory — items and categories
 */

// ─── Categories ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /inventory/categories:
 *   get:
 *     summary: List all inventory categories
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Array of categories with item counts
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
 *                     $ref: '#/components/schemas/InventoryCategory'
 */
router.get('/categories', async (_req, res, next) => {
  try {
    const categories = await inventoryService.getAllCategories()
    res.json({ success: true, data: categories })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /inventory/categories:
 *   post:
 *     summary: Create an inventory category
 *     description: Admin or Store Manager only.
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategoryRequest'
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/InventoryCategory'
 *       409:
 *         description: Category already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/categories', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { name, description } = req.body
    if (!name) throw new AppError(400, 'name is required', 'VALIDATION')
    const category = await inventoryService.createCategory({ name, description }, req.staff!.staffId)
    res.status(201).json({ success: true, data: category })
  } catch (err) { next(err) }
})

// ─── Items ────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /inventory/items:
 *   get:
 *     summary: List all inventory items
 *     description: Optionally filter by status or category.
 *     tags: [Inventory]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/ItemStatus'
 *         description: Filter by stock status
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category
 *     responses:
 *       200:
 *         description: Array of inventory items
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
 *                     $ref: '#/components/schemas/InventoryItem'
 */
router.get('/items', async (req, res, next) => {
  try {
    const { status, categoryId } = req.query as { status?: any; categoryId?: string }
    const items = await inventoryService.getAllItems({ status, categoryId })
    res.json({ success: true, data: items })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /inventory/items/low-stock:
 *   get:
 *     summary: Get all low stock and out of stock items
 *     description: Store manager and admin only. Used for local alerts and sync to cloud.
 *     tags: [Inventory]
 *     responses:
 *       200:
 *         description: Items with status LOW_STOCK or OUT_OF_STOCK
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
 *                     $ref: '#/components/schemas/InventoryItem'
 */
router.get('/items/low-stock', authorize('ADMIN', 'MANAGER', 'STORE'), async (_req, res, next) => {
  try {
    const items = await inventoryService.getLowStockItems()
    res.json({ success: true, data: items })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /inventory/items/{id}:
 *   get:
 *     summary: Get an inventory item by ID including last 20 stock movements
 *     tags: [Inventory]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Item details with movement history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/items/:id', async (req, res, next) => {
  try {
    const item = await inventoryService.getItemById(req.params.id)
    res.json({ success: true, data: item })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /inventory/items:
 *   post:
 *     summary: Add a new inventory item to the store
 *     tags: [Inventory]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateInventoryItemRequest'
 *     responses:
 *       201:
 *         description: Item created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Category not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/items', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { name, categoryId, unit, quantity, reorderLevel, description } = req.body
    if (!name || !categoryId || !unit) {
      throw new AppError(400, 'name, categoryId, and unit are required', 'VALIDATION')
    }
    const item = await inventoryService.createItem(
      { name, categoryId, unit, quantity, reorderLevel, description },
      req.staff!.staffId
    )
    res.status(201).json({ success: true, data: item })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /inventory/items/{id}:
 *   patch:
 *     summary: Update an inventory item
 *     description: Update name, unit, reorder level, or category. Does not change quantity — use stock movements for that.
 *     tags: [Inventory]
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
 *             $ref: '#/components/schemas/UpdateInventoryItemRequest'
 *     responses:
 *       200:
 *         description: Item updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/InventoryItem'
 *       404:
 *         description: Item not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/items/:id', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { name, unit, reorderLevel, description, categoryId } = req.body
    const item = await inventoryService.updateItem(
      req.params.id,
      { name, unit, reorderLevel, description, categoryId },
      req.staff!.staffId
    )
    res.json({ success: true, data: item })
  } catch (err) { next(err) }
})

export default router