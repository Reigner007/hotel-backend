import { Router } from 'express'
import { loginHandler, logoutHandler } from './auth.controller'
import { authenticate } from '../../shared/middleware/authenticate'

const router = Router()

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication — login and logout
 */

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Staff login
 *     description: Authenticates a staff member and returns a JWT token. No Bearer token required for this endpoint.
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Missing username or password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials or account inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', loginHandler)

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Staff logout
 *     description: Logs out the authenticated staff member and closes any open shift log.
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Logged out successfully
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/logout', authenticate, logoutHandler)

export default router