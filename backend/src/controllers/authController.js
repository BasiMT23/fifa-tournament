const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const userModel = require('../models/userModel');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { AppError, asyncHandler } = require('../middleware/errorMiddleware');
const logger = require('../utils/logger');

const SALT_ROUNDS = 12;

// We never store the raw refresh token in the DB — only a SHA-256 hash of it.
// This way, if the database leaks, attackers can't replay tokens directly.
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await userModel.findByEmail(email);
  if (existing) throw new AppError('An account with that email already exists', 409);

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  // Role intentionally defaults to 'player' regardless of what's in the body in production;
  // exposing role assignment publicly would let anyone self-promote to admin.
  const user = await userModel.createUser({ username, email, passwordHash, role: 'player' });

  logger.info(`New user registered: ${user.email}`);
  res.status(201).json({ success: true, data: user });
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await userModel.findByEmail(email);
  if (!user) throw new AppError('Invalid email or password', 401);

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new AppError('Invalid email or password', 401);

  const payload = { id: user.id, role: user.role, username: user.username };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await userModel.saveRefreshToken(user.id, hashToken(refreshToken), expiresAt);

  res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
  res.json({
    success: true,
    data: {
      accessToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
    },
  });
});

// POST /api/auth/refresh — issues a new access token using the httpOnly refresh cookie
const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) throw new AppError('No refresh token provided', 401);

  let decoded;
  try {
    decoded = verifyRefreshToken(token);
  } catch (err) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const stored = await userModel.findValidRefreshToken(decoded.id, hashToken(token));
  if (!stored) throw new AppError('Refresh token has been revoked', 401);

  const accessToken = signAccessToken({
    id: decoded.id,
    role: decoded.role,
    username: decoded.username,
  });

  res.json({ success: true, data: { accessToken } });
});

// POST /api/auth/logout — revokes the refresh token so it can't be reused
const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    await userModel.revokeRefreshToken(hashToken(token));
  }
  res.clearCookie('refreshToken', REFRESH_COOKIE_OPTS);
  res.json({ success: true, message: 'Logged out' });
});

// GET /api/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);
  if (!user) throw new AppError('User not found', 404);
  res.json({ success: true, data: user });
});

module.exports = { register, login, refresh, logout, getMe };
