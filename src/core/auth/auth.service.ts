import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../activity-logs/activityLog.service'

export async function login(username: string, password: string, ipAddress?: string) {
  const staff = await prisma.staff.findUnique({ where: { username } })

  if (!staff || staff.status !== 'ACTIVE') {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS')
  }

  const valid = await bcrypt.compare(password, staff.passwordHash)
  if (!valid) throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS')

  const token = jwt.sign(
  { staffId: staff.id, username: staff.username, role: staff.role },
  process.env.JWT_SECRET!,
  { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as any }
)

  // Find today's shift assignment (for context only — no blocking)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const assignment = await prisma.staffShift.findUnique({
    where: { staffId_date: { staffId: staff.id, date: today } },
  })

  if (assignment) {
    await prisma.shiftLog.create({
      data: { staffId: staff.id, shiftId: assignment.shiftId },
    })
  }

  await logActivity({
    actionType: 'LOGIN',
    entityType: 'STAFF',
    entityId: staff.id,
    staffId: staff.id,
    shiftId: assignment?.shiftId,
    ipAddress,
  })

  return {
    token,
    staff: {
      id: staff.id,
      username: staff.username,
      fullName: staff.fullName,
      role: staff.role,
    },
  }
}

export async function logout(staffId: string) {
  const openLog = await prisma.shiftLog.findFirst({
    where: { staffId, logoutTime: null },
    orderBy: { loginTime: 'desc' },
  })

  if (openLog) {
    await prisma.shiftLog.update({
      where: { id: openLog.id },
      data: { logoutTime: new Date() },
    })
  }

  await logActivity({
    actionType: 'LOGOUT',
    entityType: 'STAFF',
    entityId: staffId,
    staffId,
  })
}