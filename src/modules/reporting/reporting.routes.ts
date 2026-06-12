import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import { AppError } from '../../shared/middleware/errorHandler'
import * as reportingService from './reporting.service'

const router = Router()
router.use(authenticate)

/**
 * @swagger
 * tags:
 *   name: Reporting
 *   description: Daily summaries, revenue reports, staff activity, and sync outbox
 */

/**
 * @swagger
 * /reporting/daily-summary:
 *   post:
 *     summary: Generate daily summary for a specific date
 *     description: |
 *       Admin or Manager only.
 *       Aggregates: total revenue, occupancy rate, check-ins/outs, POS sales,
 *       top selling items, and stock movements summary.
 *       Automatically pushes result to the SyncOutbox for cloud pickup.
 *       Typically run at end of day — can also be triggered manually.
 *     tags: [Reporting]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [date]
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-02-01"
 *     responses:
 *       201:
 *         description: Summary generated and pushed to sync outbox
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/DailySummary'
 *       409:
 *         description: Summary already exists for this date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/daily-summary', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { date } = req.body
    if (!date) throw new AppError(400, 'date is required', 'VALIDATION')
    const summary = await reportingService.generateDailySummary(
      new Date(date), req.staff!.staffId
    )
    res.status(201).json({ success: true, data: summary })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reporting/daily-summary:
 *   get:
 *     summary: List daily summaries
 *     description: Returns up to 30 summaries by default. Filterable by date range.
 *     tags: [Reporting]
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Array of daily summaries
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
 *                     $ref: '#/components/schemas/DailySummary'
 */
router.get('/daily-summary', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { from, to, limit } = req.query as Record<string, string>
    const summaries = await reportingService.getSummaries({
      from, to, limit: limit ? parseInt(limit) : undefined,
    })
    res.json({ success: true, data: summaries })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reporting/daily-summary/{date}:
 *   get:
 *     summary: Get daily summary for a specific date
 *     tags: [Reporting]
 *     parameters:
 *       - in: path
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-02-01"
 *     responses:
 *       200:
 *         description: Daily summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DailySummary'
 *       404:
 *         description: No summary for this date
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/daily-summary/:date', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const summary = await reportingService.getSummaryByDate(req.params.date)
    res.json({ success: true, data: summary })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reporting/revenue:
 *   get:
 *     summary: Revenue report for a date range
 *     description: Breaks down room revenue vs POS revenue, and splits by payment method.
 *     tags: [Reporting]
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Revenue breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/RevenueReport'
 */
router.get('/revenue', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string>
    if (!from || !to) throw new AppError(400, 'from and to dates are required', 'VALIDATION')
    const report = await reportingService.getRevenueReport(from, to)
    res.json({ success: true, data: report })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reporting/staff/{staffId}/activity:
 *   get:
 *     summary: Staff activity report
 *     description: Returns all activity log entries for a staff member in a date range, with shift logs and action breakdown.
 *     tags: [Reporting]
 *     parameters:
 *       - in: path
 *         name: staffId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Staff activity breakdown
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/StaffActivityReport'
 */
router.get('/staff/:staffId/activity', authorize('ADMIN', 'MANAGER'), async (req, res, next) => {
  try {
    const { from, to } = req.query as Record<string, string>
    if (!from || !to) throw new AppError(400, 'from and to dates are required', 'VALIDATION')
    const report = await reportingService.getStaffActivityReport(req.params.staffId, from, to)
    res.json({ success: true, data: report })
  } catch (err) { next(err) }
})

/**
 * @swagger
 * /reporting/sync-outbox:
 *   get:
 *     summary: View sync outbox status
 *     description: Shows pending, sent, and failed sync events for cloud upload. Admin only.
 *     tags: [Reporting]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           $ref: '#/components/schemas/SyncStatus'
 *     responses:
 *       200:
 *         description: Sync outbox entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SyncOutboxEntry'
 */
router.get('/sync-outbox', authorize('ADMIN'), async (req, res, next) => {
  try {
    const { status } = req.query as Record<string, string>
    const entries = await reportingService.getSyncOutbox(status)
    res.json({ success: true, data: entries })
  } catch (err) { next(err) }
})

export default router