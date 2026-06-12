import bcrypt from 'bcryptjs'
import { Role, StaffStatus } from '@prisma/client'
import prisma from '../../shared/db/prisma'
import { AppError } from '../../shared/middleware/errorHandler'
import { logActivity } from '../../core/activity-logs/activityLog.service'

const PUBLIC_SELECT = {
  id: true, username: true, fullName: true,
  role: true, status: true, createdAt: true,
}

export async function createStaff(
  data: { username: string; password: string; fullName: string; role: Role },
  createdById: string
) {
  const exists = await prisma.staff.findUnique({ where: { username: data.username } })
  if (exists) throw new AppError(409, 'Username already taken', 'CONFLICT')

  const passwordHash = await bcrypt.hash(data.password, 12)
  const staff = await prisma.staff.create({
    data: { username: data.username, passwordHash, fullName: data.fullName, role: data.role, createdById },
    select: PUBLIC_SELECT,
  })

  await logActivity({
    actionType: 'STAFF_CREATED', entityType: 'STAFF',
    entityId: staff.id, staffId: createdById,
    metadata: { username: staff.username, role: staff.role },
  })

  return staff
}

export async function getAllStaff() {
  return prisma.staff.findMany({ select: PUBLIC_SELECT, orderBy: { createdAt: 'desc' } })
}

export async function getStaffById(id: string) {
  const staff = await prisma.staff.findUnique({ where: { id }, select: PUBLIC_SELECT })
  if (!staff) throw new AppError(404, 'Staff member not found', 'NOT_FOUND')
  return staff
}

export async function updateStaffStatus(id: string, status: StaffStatus, updatedById: string) {
  const staff = await prisma.staff.update({
    where: { id }, data: { status }, select: PUBLIC_SELECT,
  })
  await logActivity({
    actionType: 'STAFF_UPDATED', entityType: 'STAFF',
    entityId: id, staffId: updatedById,
    metadata: { status },
  })
  return staff
}