export function errorHandler(err, req, res, next) {
  console.error('Error:', err);

  // Zod validation errors
  if (err.name === 'ZodError') {
    // Format Zod errors into a readable message
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({
      error: `Validation error: ${messages}`,
      details: err.errors,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }

  // Prisma errors
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Resource not found' });
  }

  // Default error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  res.status(statusCode).json({ error: message });
}

export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AppError';
  }
}
