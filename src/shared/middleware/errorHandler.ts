import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code ?? 'ERROR',
      message: err.message,
    })
    return
  }

  // Prisma unique constraint
  if ((err as any).code === 'P2002') {
    res.status(409).json({ success: false, code: 'CONFLICT', message: 'A record with this value already exists' })
    return
  }

  // Prisma record not found
  if ((err as any).code === 'P2025') {
    res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Record not found' })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' })
}