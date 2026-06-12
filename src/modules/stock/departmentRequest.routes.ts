import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { AppError } from '../../shared/middleware/errorHandler'
import * as requestService from './departmentRequest.service'
import { Department } from '@prisma/client'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Department Requests
 *   description: Departments request stock from the central store
 */

/**
 * @swagger
 * /requests:
 *   get:
 *     summary: List all department stock requests
 *     description: Store, manager, and admin can see all. Filterable by department and status.
 *     tags: [Department Requests]
 *     parameters:
 *       - in: query
 *         name: department
 *         schema:
 *           $ref: '#/components/schemas/Department'
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/RequestStatus'
 *     responses:
 *       200:
 *         description: Array of department requests with items
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
 *                     $ref: '#/components/schemas/DepartmentRequest'
 */
router.get('/', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { department, status } = req.query as Record<string, string>
    const requests = await requestService.getRequests({
      department: department as Department,
      status,
    })
    res.json({ success: true, data: requests })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /requests/{id}:
 *   get:
 *     summary: Get a department request by ID
 *     tags: [Department Requests]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Request details with items and stock movements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DepartmentRequest'
 *       404:
 *         description: Request not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/:id', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const request = await requestService.getRequestById(req.params.id)
    res.json({ success: true, data: request })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /requests:
 *   post:
 *     summary: Create a stock request from a department
 *     description: |
 *       Any staff member can submit a request on behalf of their department.
 *       Request starts as PENDING until approved by the store.
 *     tags: [Department Requests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDepartmentRequestRequest'
 *     responses:
 *       201:
 *         description: Request created with status PENDING
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DepartmentRequest'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/', async (req, res, next) => {
  try {
    const { department, items, note, shiftId } = req.body
    if (!department) throw new AppError(400, 'department is required', 'VALIDATION')
    if (!Object.values(Department).includes(department)) {
      throw new AppError(400, `department must be one of: ${Object.values(Department).join(', ')}`, 'VALIDATION')
    }
    const request = await requestService.createRequest(
      { department, items, note },
      req.staff!.staffId,
      shiftId
    )
    res.status(201).json({ success: true, data: request })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /requests/{id}/approve:
 *   post:
 *     summary: Approve and fulfil a stock request
 *     description: |
 *       Store manager, manager, or admin only.
 *       Checks stock availability for all items before approving.
 *       On approval, records an OUT stock movement for each item automatically.
 *       Request status changes to FULFILLED.
 *     tags: [Department Requests]
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
 *               reviewNote:
 *                 type: string
 *                 example: Approved for morning service
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Request approved and stock movements recorded
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
 *                     requestId:
 *                       type: string
 *                       format: uuid
 *                     movements:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/StockMovement'
 *       400:
 *         description: Insufficient stock for one or more items
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Request already processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/approve', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { reviewNote, shiftId } = req.body
    const result = await requestService.approveAndFulfil(
      req.params.id,
      req.staff!.staffId,
      shiftId,
      reviewNote
    )
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /requests/{id}/reject:
 *   post:
 *     summary: Reject a stock request
 *     description: Store manager, manager, or admin only. Request status changes to REJECTED.
 *     tags: [Department Requests]
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
 *               reviewNote:
 *                 type: string
 *                 example: Item currently out of stock
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Request rejected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DepartmentRequest'
 *       409:
 *         description: Request already processed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/:id/reject', authorize('ADMIN', 'MANAGER', 'STORE'), async (req, res, next) => {
  try {
    const { reviewNote, shiftId } = req.body
    const result = await requestService.rejectRequest(
      req.params.id,
      req.staff!.staffId,
      shiftId,
      reviewNote
    )
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
})

export default router