// Load environment variables FIRST - this import must come before all others
import './env.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import config from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import companiesRoutes from './routes/companies.js';
import adminRoutes from './routes/admin.js';
import integrationsRoutes from './routes/integrations.js';
import promptsRoutes from './routes/prompts.js';
import timeStudiesRoutes from './routes/timeStudies.js';
import organizationsRoutes from './routes/organizations.js';
import departmentsRoutes from './routes/departments.js';
import knowledgeFilesRoutes from './routes/knowledgeFiles.js';
import activityRoutes from './routes/activity.js';
import seedRoutes from './routes/seed.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/time-studies', timeStudiesRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/prompts', promptsRoutes);
// Also mount prompt creation under companies for cleaner API
app.use('/api', promptsRoutes);

// Organization/Department hierarchy routes
app.use('/api/organizations', organizationsRoutes);
app.use('/api', departmentsRoutes); // Handles both /organizations/:orgId/departments and /departments/:id

// Knowledge file management routes
app.use('/api/knowledge-files', knowledgeFilesRoutes);

// Activity tracking routes (admin)
app.use('/api/admin/activity', activityRoutes);

// Seed routes (for initial data population)
app.use('/api/seed', seedRoutes);

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});
