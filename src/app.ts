import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './shared/swagger.config';

// ── Routes ────────────────────────────────────────────────────────────────────
import authRoutes from './core/auth/auth.routes';
import staffRoutes from './staff/profiles/staff.routes';
import shiftRoutes from './staff/shifts/shift.routes';
import roomRoutes from './modules/rooms/room.routes';
import guestRoutes from './modules/frontdesk/guest.routes';
import reservationRoutes from './modules/reservations/reservation.routes';
import stayRoutes from './modules/stays/stay.routes';
import billingRoutes from './modules/billing/billing.routes';
import inventoryRoutes from './modules/inventory/inventory.routes';
import stockRoutes from './modules/stock/stock.routes';
import departmentReqRoutes from './modules/stock/departmentRequest.routes';
import housekeepingRoutes from './modules/housekeeping/housekeeping.routes';
import posRoutes from './modules/pos/pos.routes';
import kitchenRoutes from './modules/kitchen/kitchen.routes';
import reportingRoutes from './modules/reporting/reporting.routes';

// ── Middleware ────────────────────────────────────────────────────────────────
import { errorHandler } from './shared/middleware/errorHandler';
import { requestLogger } from './shared/middleware/requestLogger';

const app = express();

// ✅ ADD CORS HERE (Before any routes)
app.use(cors({
  origin: [
    'https://hotelos-frontend.netlify.app',   // Production
    'http://localhost:5173',                  // Vite local dev
    'http://localhost:3000',                  // Alternative local
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ],
  credentials: true,                          // Important for cookies/auth
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-access-token',
    'Accept',
  ],
  exposedHeaders: ['Authorization'],
  maxAge: 3600
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'Hotel API Docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: 'list',
  },
}));

app.get('/api/docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── API Routes ────────────────────────────────────────────────────────────────
const v1 = '/api/v1';
app.use(`${v1}/auth`, authRoutes);
app.use(`${v1}/staff`, staffRoutes);
app.use(`${v1}/shifts`, shiftRoutes);
app.use(`${v1}/rooms`, roomRoutes);
app.use(`${v1}/guests`, guestRoutes);
app.use(`${v1}/reservations`, reservationRoutes);
app.use(`${v1}/stays`, stayRoutes);
app.use(`${v1}/billing`, billingRoutes);
app.use(`${v1}/inventory`, inventoryRoutes);
app.use(`${v1}/stock`, stockRoutes);
app.use(`${v1}/requests`, departmentReqRoutes);
app.use(`${v1}/housekeeping`, housekeepingRoutes);
app.use(`${v1}/pos`, posRoutes);
app.use(`${v1}/kitchen`, kitchenRoutes);
app.use(`${v1}/reporting`, reportingRoutes);

// Hotel profile
app.get(`${v1}/hotel-profile`, (_req, res) => {
  res.json({ success: true, data: { name: process.env.HOTEL_NAME || 'Edis Premier Hotel and Suites', address: '', city: '', phone: '', logo: '' } });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;