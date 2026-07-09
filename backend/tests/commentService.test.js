const { canDeleteComment, validateContent, MAX_COMMENT_LENGTH } = require('../src/services/commentService');

describe('canDeleteComment', () => {
  const comment = { id: 1, user_id: 42 };

  test('the comment author can delete their own comment', () => {
    expect(canDeleteComment(comment, { id: 42, role: 'player' })).toBe(true);
  });

  test('a different player cannot delete someone else\'s comment', () => {
    expect(canDeleteComment(comment, { id: 99, role: 'player' })).toBe(false);
  });

  test('an admin can delete any comment', () => {
    expect(canDeleteComment(comment, { id: 99, role: 'admin' })).toBe(true);
  });

  test('an organizer can delete any comment', () => {
    expect(canDeleteComment(comment, { id: 99, role: 'organizer' })).toBe(true);
  });

  test('returns false for missing comment or user', () => {
    expect(canDeleteComment(null, { id: 1, role: 'admin' })).toBe(false);
    expect(canDeleteComment(comment, null)).toBe(false);
  });
});

describe('validateContent', () => {
  test('rejects empty content', () => {
    expect(validateContent('')).toBeTruthy();
    expect(validateContent('   ')).toBeTruthy();
  });

  test('rejects non-string content', () => {
    expect(validateContent(null)).toBeTruthy();
    expect(validateContent(123)).toBeTruthy();
  });

  test('accepts normal content', () => {
    expect(validateContent('GG, that was a lucky goal!')).toBeNull();
  });

  test('rejects content over the max length', () => {
    const tooLong = 'a'.repeat(MAX_COMMENT_LENGTH + 1);
    expect(validateContent(tooLong)).toBeTruthy();
  });

  test('accepts content exactly at the max length', () => {
    const exact = 'a'.repeat(MAX_COMMENT_LENGTH);
    expect(validateContent(exact)).toBeNull();
  });
});
