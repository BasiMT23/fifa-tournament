const commentModel = require('../models/commentModel');
const tournamentModel = require('../models/tournamentModel');
const { canDeleteComment, validateContent } = require('../services/commentService');
const { AppError, asyncHandler } = require('../middleware/errorMiddleware');

// GET /api/matches/:matchId/comments
const listComments = asyncHandler(async (req, res) => {
  const comments = await commentModel.listComments(req.params.matchId);
  res.json({ success: true, data: comments });
});

// POST /api/matches/:matchId/comments
// Body: { content }
const postComment = asyncHandler(async (req, res) => {
  const match = await tournamentModel.getMatchById(req.params.matchId);
  if (!match) throw new AppError('Match not found', 404);

  const { content } = req.body;
  const validationError = validateContent(content);
  if (validationError) throw new AppError(validationError, 400);

  const comment = await commentModel.createComment(match.id, req.user.id, content.trim());
  const payload = { ...comment, username: req.user.username, matchId: match.id };

  // Broadcast to everyone watching this tournament — real-time trash talk feed
  const io = req.app.get('io');
  if (io) {
    io.to(`tournament:${match.tournament_id}`).emit('comment:new', payload);
  }

  res.status(201).json({ success: true, data: payload });
});

// DELETE /api/matches/:matchId/comments/:commentId
const deleteComment = asyncHandler(async (req, res) => {
  const comment = await commentModel.getCommentById(req.params.commentId);
  if (!comment) throw new AppError('Comment not found', 404);
  if (!canDeleteComment(comment, req.user)) {
    throw new AppError('You do not have permission to delete this comment', 403);
  }

  await commentModel.deleteComment(comment.id);

  const match = await tournamentModel.getMatchById(comment.match_id);
  const io = req.app.get('io');
  if (io && match) {
    io.to(`tournament:${match.tournament_id}`).emit('comment:deleted', { commentId: comment.id, matchId: match.id });
  }

  res.json({ success: true, message: 'Comment deleted' });
});

module.exports = { listComments, postComment, deleteComment };
