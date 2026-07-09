const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const authController = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validate, registerSchema, loginSchema } = require('../utils/validators');

// Stricter limiter on auth endpoints to slow down brute-force login attempts
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.get('/me', protect, authController.getMe);

module.exports = router;
