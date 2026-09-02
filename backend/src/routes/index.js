// Central API router. Each feature module exposes a default Express router at
// src/modules/<name>/<name>.routes.js. Mount points below are the REST contract.
import { Router } from 'express';

import authRoutes from '../modules/auth/auth.routes.js';
import userRoutes from '../modules/users/users.routes.js';
import clinicRoutes from '../modules/clinics/clinics.routes.js';
import vetRoutes from '../modules/veterinarians/veterinarians.routes.js';
import geoRoutes from '../modules/geo/geo.routes.js';
import animalRoutes from '../modules/animals/animals.routes.js';
import appointmentRoutes from '../modules/appointments/appointments.routes.js';
import availabilityRoutes from '../modules/availability/availability.routes.js';
import vaccinationRoutes from '../modules/vaccinations/vaccinations.routes.js';
import reviewRoutes from '../modules/reviews/reviews.routes.js';
import emergencyRoutes from '../modules/emergency/emergency.routes.js';
import articleRoutes from '../modules/articles/articles.routes.js';
import notificationRoutes from '../modules/notifications/notifications.routes.js';
import analyticsRoutes from '../modules/analytics/analytics.routes.js';

const router = Router();

router.get('/health', (_req, res) =>
  res.json({ success: true, service: 'vetconnect-ekiti-api', status: 'ok', time: new Date().toISOString() })
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/clinics', clinicRoutes);
router.use('/veterinarians', vetRoutes);
router.use('/geo', geoRoutes);
router.use('/animals', animalRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/availability', availabilityRoutes);
router.use('/vaccinations', vaccinationRoutes);
router.use('/reviews', reviewRoutes);
router.use('/emergency', emergencyRoutes);
router.use('/articles', articleRoutes);
router.use('/notifications', notificationRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
