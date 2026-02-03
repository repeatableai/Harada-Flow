// DEPRECATED: This file is kept for backwards compatibility only.
// The application now uses apiClient.js with a PostgreSQL backend.
// All new code should import from apiClient.js directly.

import { apiClient } from './apiClient';

// Re-export apiClient as base44 for backwards compatibility
export const base44 = apiClient;
