// Note: dotenv is loaded in index.js before this module

export default {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('JWT_SECRET is required in production'); })()
      : 'dev-secret-change-in-production'),
    refreshSecret: process.env.JWT_REFRESH_SECRET || (process.env.NODE_ENV === 'production'
      ? (() => { throw new Error('JWT_REFRESH_SECRET is required in production'); })()
      : 'dev-refresh-secret-change-in-production'),
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },

  cors: {
    // Support multiple origins in development (comma-separated in env)
    origin: process.env.NODE_ENV === 'development'
      ? (process.env.CORS_ORIGIN || 'http://localhost:5174').split(',').map(o => o.trim())
      : process.env.CORS_ORIGIN || 'http://localhost:5174',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    from: process.env.EMAIL_FROM || 'Role Deliverable Matrices <onboarding@resend.dev>',
  },

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
    model: (process.env.ANTHROPIC_MODEL || 'claude-opus-4-6').trim(),
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_KEY, // Service role key for server-side operations
    storageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'knowledge-files',
  },

  // Session durations
  session: {
    userDuration: 72 * 60 * 60 * 1000, // 72 hours in ms
    verificationCodeDuration: 5 * 60 * 1000, // 5 minutes in ms
  },
};
