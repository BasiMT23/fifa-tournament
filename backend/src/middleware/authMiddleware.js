const { verifyAccessToken } = require('../utils/jwt');
const { AppError } = require('./errorMiddleware');

// Reads "Authorization: Bearer <token>", verifies it, attaches req.user.
const protect = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(new AppError('Not authenticated — missing token', 401));
  }

  const token = header.split(' ')[1];
  try {
    req.user = verifyAccessToken(token); // { id, role, username }
    next();
  } catch (err) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

// Usage: authorize('admin', 'organizer') — allows only listed roles through.
// Must run AFTER `protect` since it relies on req.user.
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Not authenticated', 401));
  if (!allowedRoles.includes(req.user.role)) {
    return next(new AppError('You do not have permission to perform this action', 403));
  }
  next();
};

module.exports = { protect, authorize };
