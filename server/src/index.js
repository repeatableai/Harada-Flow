// Load environment variables FIRST - this import must come before all others
import './env.js';

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

// Create uploads directory if it doesn't exist (local fallback)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// Initialize Supabase storage bucket
import { ensureBucketExists } from './services/storage.service.js';
ensureBucketExists().catch(err => console.error('Failed to ensure storage bucket exists:', err));
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
import cuiScanRoutes from './routes/cuiScan.js';
import dossierRoutes from './routes/dossier.js';
import deliverableRoutes from './routes/deliverable.js';
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

// CUI data sniffer routes
app.use('/api/cui', cuiScanRoutes);

// Dossier generation routes (Session 00)
app.use('/api/dossier', dossierRoutes);

// Deliverable generation routes (Working + Executive modes)
app.use('/api/deliverable', deliverableRoutes);

// Seed routes (for initial data population)
app.use('/api/seed', seedRoutes);

// Error handler
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
});
