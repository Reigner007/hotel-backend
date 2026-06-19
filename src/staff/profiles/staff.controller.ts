import { Request, Response, NextFunction } from 'express'
import { Role, StaffStatus } from '@prisma/client'
import * as staffService from './staff.service'
import { AppError } from '../../shared/middleware/errorHandler'

function mapStaffOutput(staff: any) {
  return {
    id: staff.id,
    name: staff.name || staff.fullName,
    fullName: staff.fullName,
    username: staff.username,
    role: staff.role,
    status: staff.status === 'ACTIVE' ? 'Active' as const : staff.status === 'INACTIVE' ? 'Offline' as const : 'Suspended' as const,
    phone: staff.phone || '',
    email: staff.email || '',
    shift: staff.shift || 'Morning',
    lastActive: staff.lastActive || '',
    avatarColor: staff.avatarColor || 'bg-navy',
    permissions: staff.permissions ?? 1,
    joinedDate: staff.joinedDate || '',
    actionsLogged: staff.actionsLogged ?? 0,
    createdAt: staff.createdAt,
  }
}

export async function createStaffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password, fullName, name, role, phone, email, shift } = req.body
    const staffName = name || fullName
    if (!username || !password || !staffName || !role) {
      throw new AppError(400, 'username, password, name/fullName, and role are required', 'VALIDATION')
    }
    if (!Object.values(Role).includes(role)) {
      throw new AppError(400, `role must be one of: ${Object.values(Role).join(', ')}`, 'VALIDATION')
    }
    const staff = await staffService.createStaff({
      username, password, fullName: staffName, name: staffName, role,
      phone: phone || '', email: email || '', shift: shift || 'Morning',
    }, req.staff!.staffId)
    res.status(201).json({ success: true, data: mapStaffOutput(staff) })
  } catch (err) { next(err) }
}

export async function getAllStaffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await staffService.getAllStaff()
    res.json({ success: true, data: staff.map(mapStaffOutput) })
  } catch (err) { next(err) }
}

export async function getStaffByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await staffService.getStaffById(req.params.id)
    res.json({ success: true, data: mapStaffOutput(staff) })
  } catch (err) { next(err) }
}

export async function deleteStaffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await staffService.deleteStaff(req.params.id, req.staff!.staffId)
    res.json({ success: true, data: null })
  } catch (err) { next(err) }
}

export async function updateStaffStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    let { status } = req.body
    if (status === 'Active') status = 'ACTIVE'
    else if (status === 'Offline') status = 'INACTIVE'
    else if (status === 'Suspended') status = 'SUSPENDED'
    if (!Object.values(StaffStatus).includes(status)) {
      throw new AppError(400, `status must be one of: ${Object.values(StaffStatus).join(', ')}`, 'VALIDATION')
    }
    const staff = await staffService.updateStaffStatus(req.params.id, status, req.staff!.staffId)
    res.json({ success: true, data: mapStaffOutput(staff) })
  } catch (err) { next(err) }
}