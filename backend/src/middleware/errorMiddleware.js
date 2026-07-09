const logger = require('../utils/logger');

// Custom error class so controllers can throw errors with a specific
// HTTP status instead of always defaulting to 500.
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes "expected" errors from bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

// 404 handler — runs when no route matched
const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

// Final error handler — must have 4 args for Express to recognize it as such
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  if (statusCode >= 500) {
    logger.error(err); // full stack trace for unexpected errors
  } else {
    logger.warn(`${statusCode} - ${err.message} - ${req.method} ${req.originalUrl}`);
  }

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error',
    // Only leak stack traces in development
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

// Wraps async route handlers so we don't need try/catch in every controller.
// Any rejected promise gets forwarded to errorHandler via next().
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { AppError, notFound, errorHandler, asyncHandler };
