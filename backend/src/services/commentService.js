// Who's allowed to delete a given comment: the author themselves, or a
// moderator (admin/organizer) cleaning up abusive trash talk.
const canDeleteComment = (comment, user) => {
  if (!comment || !user) return false;
  if (comment.user_id === user.id) return true;
  return ['admin', 'organizer'].includes(user.role);
};

// Basic content guardrails — real moderation (profanity filtering, etc.)
// would plug in here later; for now just stop empty/oversized spam.
const MAX_COMMENT_LENGTH = 500;
const validateContent = (content) => {
  if (typeof content !== 'string' || content.trim().length === 0) {
    return 'Comment cannot be empty';
  }
  if (content.length > MAX_COMMENT_LENGTH) {
    return `Comment cannot exceed ${MAX_COMMENT_LENGTH} characters`;
  }
  return null;
};

module.exports = { canDeleteComment, validateContent, MAX_COMMENT_LENGTH };
