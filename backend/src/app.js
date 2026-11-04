import express from 'express';
import cors from 'cors';
import { FRONTEND_ROOT } from './config.js';
import { errorMiddleware } from './errors.js';
import authRoutes from './routes/auth.js';
import assessmentRoutes from './routes/assessments.js';
import checkinRoutes from './routes/checkins.js';
import therapistRoutes from './routes/therapists.js';
import bookingRoutes from './routes/bookings.js';
import adminRoutes from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'maanas-api', time: new Date().toISOString() }));
  app.use('/api/auth', authRoutes);
  app.use('/api/assessments', assessmentRoutes);
  app.use('/api/checkins', checkinRoutes);
  app.use('/api/therapists', therapistRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No such API endpoint.' } }));

  // Serve the web app from the same origin, so there is nothing else to run.
  app.use(express.static(FRONTEND_ROOT, { extensions: ['html'] }));
  app.get('*', (_req, res) => res.sendFile('index.html', { root: FRONTEND_ROOT }));

  app.use(errorMiddleware);
  return app;
}
