import { Request, Response, NextFunction } from 'express'
import * as authService from './auth.service'

export async function loginHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).json({ success: false, message: 'username and password are required' })
      return
    }
    const result = await authService.login(username, password, req.ip)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

export async function logoutHandler(req: Request, res: Response, next: NextFunction) {
  try {
    await authService.logout(req.staff!.staffId)
    res.json({ success: true, message: 'Logged out successfully' })
  } catch (err) { next(err) }
}