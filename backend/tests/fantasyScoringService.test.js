const { calculatePoints } = require('../src/services/fantasyScoringService');

describe('calculatePoints', () => {
  test('a defender who plays 90 mins, scores, and keeps a clean sheet', () => {
    const points = calculatePoints({
      position: 'DEF',
      minutesPlayed: 90,
      goals: 1,
      assists: 0,
      cleanSheet: true,
    });
    // 2 (90 mins) + 6 (DEF goal) + 4 (clean sheet) = 12
    expect(points).toBe(12);
  });

  test('a forward scoring a brace with an assist, no clean sheet credit', () => {
    const points = calculatePoints({
      position: 'FWD',
      minutesPlayed: 90,
      goals: 2,
      assists: 1,
      cleanSheet: true, // shouldn't matter for FWD — 0 points either way
    });
    // 2 (mins) + 4*2 (FWD goals) + 3 (assist) + 0 (FWD clean sheet worth nothing) = 13
    expect(points).toBe(13);
  });

  test('a substitute who plays under 60 minutes gets the lower appearance bonus', () => {
    const points = calculatePoints({ position: 'MID', minutesPlayed: 20, goals: 0, assists: 0, cleanSheet: false });
    expect(points).toBe(1);
  });

  test('clean sheet does not count if the player played under 60 minutes', () => {
    const points = calculatePoints({ position: 'GK', minutesPlayed: 45, goals: 0, assists: 0, cleanSheet: true });
    expect(points).toBe(1); // just the appearance point, no clean sheet bonus
  });

  test('captain points are doubled', () => {
    const base = calculatePoints({ position: 'MID', minutesPlayed: 90, goals: 1, assists: 1, cleanSheet: false });
    const asCaptain = calculatePoints(
      { position: 'MID', minutesPlayed: 90, goals: 1, assists: 1, cleanSheet: false },
      true
    );
    expect(asCaptain).toBe(base * 2);
  });

  test('rejects an invalid position', () => {
    expect(() => calculatePoints({ position: 'STRIKER', minutesPlayed: 90 })).toThrow();
  });
});
