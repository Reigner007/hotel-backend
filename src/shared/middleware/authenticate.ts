import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { Role } from '@prisma/client'
import { AppError } from './errorHandler'

export interface AuthPayload {
  staffId: string
  username: string
  role: Role
}

declare global {
  namespace Express {
    interface Request {
      staff?: AuthPayload
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'No token provided', 'UNAUTHORIZED'))
  }
  try {
    const token = header.split(' ')[1]
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    req.staff = payload
    next()
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'))
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.staff) return next(new AppError(401, 'Not authenticated', 'UNAUTHORIZED'))
    if (!roles.includes(req.staff.role)) {
      return next(new AppError(403, 'You do not have permission to perform this action', 'FORBIDDEN'))
    }
    next()
  }
}