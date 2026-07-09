const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const tournamentRoutes = require('./routes/tournamentRoutes');
const predictionRoutes = require('./routes/predictionRoutes');
const matchRoutes = require('./routes/matchRoutes');
const fantasyRoutes = require('./routes/fantasyRoutes');
const externalDataRoutes = require('./routes/externalDataRoutes');
// Comments routes get added here in a later step:
// const commentRoutes = require('./routes/commentRoutes');

const app = express();

// ---- Security & parsing middleware ----
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // needed so the refresh-token cookie is sent cross-origin
  })
);
app.use(express.json());
app.use(cookieParser());

// ---- Logging: Morgan writes HTTP access logs through Winston ----
app.use(morgan('combined', { stream: logger.stream }));

// ---- Global rate limiting (in addition to the stricter one on /auth) ----
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// ---- Health check ----
app.get('/api/health', (req, res) => res.json({ success: true, message: 'API is healthy' }));

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/tournaments', tournamentRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/fantasy', fantasyRoutes);
app.use('/api/external', externalDataRoutes);
// app.use('/api/comments', commentRoutes);

// ---- 404 + centralized error handler (must be last) ----
app.use(notFound);
app.use(errorHandler);

module.exports = app;
