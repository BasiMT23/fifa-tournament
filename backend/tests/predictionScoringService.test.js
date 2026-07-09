const { pointsForRound } = require('../src/services/predictionScoringService');

describe('pointsForRound', () => {
  test('round 1 (e.g. Round of 16) is worth the base amount', () => {
    expect(pointsForRound(1)).toBe(1);
  });

  test('points double each round, rewarding later-round accuracy more', () => {
    expect(pointsForRound(2)).toBe(2);
    expect(pointsForRound(3)).toBe(4);
    expect(pointsForRound(4)).toBe(8);
  });

  test('a final (round 5 in a 32-team bracket) is worth far more than round 1', () => {
    expect(pointsForRound(5)).toBeGreaterThan(pointsForRound(1) * 10);
  });
});
