import { Request, Response, NextFunction } from 'express'
import { Role, StaffStatus } from '@prisma/client'
import * as staffService from './staff.service'
import { AppError } from '../../shared/middleware/errorHandler'

export async function createStaffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password, fullName, role } = req.body
    if (!username || !password || !fullName || !role) {
      throw new AppError(400, 'username, password, fullName, and role are required', 'VALIDATION')
    }
    if (!Object.values(Role).includes(role)) {
      throw new AppError(400, `role must be one of: ${Object.values(Role).join(', ')}`, 'VALIDATION')
    }
    const staff = await staffService.createStaff({ username, password, fullName, role }, req.staff!.staffId)
    res.status(201).json({ success: true, data: staff })
  } catch (err) { next(err) }
}

export async function getAllStaffHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await staffService.getAllStaff()
    res.json({ success: true, data: staff })
  } catch (err) { next(err) }
}

export async function getStaffByIdHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const staff = await staffService.getStaffById(req.params.id)
    res.json({ success: true, data: staff })
  } catch (err) { next(err) }
}

export async function updateStaffStatusHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { status } = req.body
    if (!Object.values(StaffStatus).includes(status)) {
      throw new AppError(400, `status must be one of: ${Object.values(StaffStatus).join(', ')}`, 'VALIDATION')
    }
    const staff = await staffService.updateStaffStatus(req.params.id, status, req.staff!.staffId)
    res.json({ success: true, data: staff })
  } catch (err) { next(err) }
}