import { Router } from 'express'
import { authenticate, authorize } from '../../shared/middleware/authenticate'
import prisma from '../../shared/db/prisma'

const router = Router()
router.use(authenticate)

router.get('/', authorize('ADMIN', 'MANAGER', 'FRONT_DESK'), async (_req, res, next) => {
  try {
    const logs = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: {
        staff: { select: { fullName: true, username: true } },
        shift: { select: { name: true } },
      },
    })
    res.json({ success: true, data: logs })
  } catch (err) { next(err) }
})

export default router
