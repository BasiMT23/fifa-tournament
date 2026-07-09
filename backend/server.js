require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

const app = require('./src/app');
const logger = require('./src/utils/logger');
const { verifyAccessToken } = require('./src/utils/jwt');

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true },
});
app.set('io', io);

// Socket auth is OPTIONAL, not required: anonymous spectators can still watch
// live scores and bracket updates without logging in. If a token IS provided
// (client sends it as `auth: { token }` when connecting), we verify it and
// attach the user — this is what lets us later gate things like "only
// authenticated users can post via socket" or show "X is typing" with a name.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(); // anonymous spectator — allowed through

  try {
    socket.user = verifyAccessToken(token); // { id, username, role }
  } catch (err) {
    logger.debug(`Socket connected with an invalid token (treated as anonymous): ${err.message}`);
  }
  next();
});

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}${socket.user ? ` (user ${socket.user.username})` : ' (anonymous)'}`);

  // Clients join a room per tournament so broadcasts (scores, bracket
  // updates, comments, predictions) only reach people actually watching it.
  socket.on('tournament:join', (tournamentId) => {
    socket.join(`tournament:${tournamentId}`);
    logger.debug(`Socket ${socket.id} joined tournament:${tournamentId}`);
  });

  socket.on('tournament:leave', (tournamentId) => {
    socket.leave(`tournament:${tournamentId}`);
  });

  // Lightweight "someone is typing a comment" indicator — purely ephemeral,
  // never persisted, so it's fine to just relay it straight through.
  socket.on('comment:typing', ({ tournamentId, matchId }) => {
    if (!socket.user) return; // only real users show up as "typing"
    socket.to(`tournament:${tournamentId}`).emit('comment:typing', {
      matchId,
      username: socket.user.username,
    });
  });

  socket.on('disconnect', () => {
    logger.debug(`Socket disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Prevent the process from crashing silently on unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
});
