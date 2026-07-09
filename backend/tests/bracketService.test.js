const {
  generateSeedOrder,
  buildKnockoutBracket,
  determineWinner,
} = require('../src/services/bracketService');

describe('generateSeedOrder', () => {
  test('produces the classic 1v16-style seeding for size 8', () => {
    expect(generateSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  test('top two seeds can only meet in the final for size 4', () => {
    // [1, 4, 2, 3] -> match 0: 1v4, match 1: 2v3 -> winners meet in round 2
    expect(generateSeedOrder(4)).toEqual([1, 4, 2, 3]);
  });
});

describe('buildKnockoutBracket', () => {
  const makeParticipants = (n) =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `Team ${i + 1}` }));

  test('creates correct number of rounds for 8 participants', () => {
    const { rounds, totalRounds } = buildKnockoutBracket(makeParticipants(8));
    expect(totalRounds).toBe(3); // quarter, semi, final
    expect(rounds[0]).toHaveLength(4);
    expect(rounds[1]).toHaveLength(2);
    expect(rounds[2]).toHaveLength(1);
  });

  test('pads non-power-of-two participant counts with byes', () => {
    const { rounds } = buildKnockoutBracket(makeParticipants(6));
    // 6 participants -> bracket size 8 -> round 1 still has 4 matches, some with a null slot
    expect(rounds[0]).toHaveLength(4);
    const byeCount = rounds[0].filter((m) => !m.participant1 || !m.participant2).length;
    expect(byeCount).toBe(2); // 8 - 6 = 2 byes
  });

  test('throws if fewer than 2 participants', () => {
    expect(() => buildKnockoutBracket(makeParticipants(1))).toThrow();
  });
});

describe('determineWinner', () => {
  test('returns the higher-scoring participant id', () => {
    const match = { participant1_id: 1, participant2_id: 2, participant1_score: 3, participant2_score: 1 };
    expect(determineWinner(match)).toBe(1);
  });

  test('throws on a draw when a winner is required (knockout)', () => {
    const match = { participant1_id: 1, participant2_id: 2, participant1_score: 2, participant2_score: 2 };
    expect(() => determineWinner(match, true)).toThrow();
  });

  test('returns null on a draw when a winner is not required (round robin)', () => {
    const match = { participant1_id: 1, participant2_id: 2, participant1_score: 2, participant2_score: 2 };
    expect(determineWinner(match, false)).toBeNull();
  });
});
