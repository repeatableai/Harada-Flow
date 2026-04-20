// Vercel serverless function entry point
import '../server/src/env.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { errorHandler } from '../server/src/middleware/errorHandler.js';
import authRoutes from '../server/src/routes/auth.js';
import companiesRoutes from '../server/src/routes/companies.js';
import adminRoutes from '../server/src/routes/admin.js';
import integrationsRoutes from '../server/src/routes/integrations.js';
import promptsRoutes from '../server/src/routes/prompts.js';
import timeStudiesRoutes from '../server/src/routes/timeStudies.js';
import organizationsRoutes from '../server/src/routes/organizations.js';
import departmentsRoutes from '../server/src/routes/departments.js';
import knowledgeFilesRoutes from '../server/src/routes/knowledgeFiles.js';
import activityRoutes from '../server/src/routes/activity.js';
import cuiScanRoutes from '../server/src/routes/cuiScan.js';
import dossierRoutes from '../server/src/routes/dossier.js';
import deliverableRoutes from '../server/src/routes/deliverable.js';
import acdRoutes from '../server/src/routes/acd.js';
import sessionCloseRoutes from '../server/src/routes/sessionClose.js';
import seedRoutes from '../server/src/routes/seed.js';

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/prompts', promptsRoutes);
app.use('/api', promptsRoutes); // Mount prompt creation under /api/companies/:id/prompts
app.use('/api/time-studies', timeStudiesRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/knowledge-files', knowledgeFilesRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/cui-scan', cuiScanRoutes);
app.use('/api/dossier', dossierRoutes);
app.use('/api/deliverable', deliverableRoutes);
app.use('/api/acd', acdRoutes);
app.use('/api/session', sessionCloseRoutes);
app.use('/api/seed', seedRoutes);
app.use(errorHandler);

export default app;
