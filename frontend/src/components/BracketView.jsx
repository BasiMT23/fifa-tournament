import { useMemo, useState, useEffect } from 'react';
import MatchCard from './MatchCard';

const CARD_H = 84;
const CARD_W = 220;
const GAP_Y = 20;
const GAP_X = 64;

/**
 * Groups flat match list into rounds, computes each match's vertical center
 * so that round 2 sits at the midpoint of the two round-1 matches feeding it,
 * round 3 at the midpoint of round 2, etc. — this is what makes the bracket
 * lines converge correctly without any DOM measurement.
 */
function layoutRounds(matches) {
  const rounds = {};
  matches.forEach((m) => {
    rounds[m.round] = rounds[m.round] || [];
    rounds[m.round].push(m);
  });
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  roundNumbers.forEach((r) => rounds[r].sort((a, b) => a.match_index - b.match_index));

  const positions = {}; // matchId -> { round, index, y }
  const firstRound = rounds[roundNumbers[0]] || [];
  firstRound.forEach((m, i) => {
    positions[m.id] = { round: roundNumbers[0], index: i, y: i * (CARD_H + GAP_Y) + CARD_H / 2 };
  });

  for (let ri = 1; ri < roundNumbers.length; ri++) {
    const r = roundNumbers[ri];
    rounds[r].forEach((m, i) => {
      const prevRound = rounds[roundNumbers[ri - 1]];
      const feeder1 = prevRound[i * 2];
      const feeder2 = prevRound[i * 2 + 1];
      const y1 = feeder1 ? positions[feeder1.id].y : 0;
      const y2 = feeder2 ? positions[feeder2.id].y : y1;
      positions[m.id] = { round: r, index: i, y: (y1 + y2) / 2 };
    });
  }

  const totalHeight = firstRound.length * (CARD_H + GAP_Y) - GAP_Y;
  return { rounds, roundNumbers, positions, totalHeight };
}

export default function BracketView({ matches, onReportScore, canManage, recentlyAdvancedMatchId }) {
  const { rounds, roundNumbers, positions, totalHeight } = useMemo(() => layoutRounds(matches || []), [matches]);
  const [pulseId, setPulseId] = useState(null);

  useEffect(() => {
    if (!recentlyAdvancedMatchId) return;
    setPulseId(recentlyAdvancedMatchId);
    const t = setTimeout(() => setPulseId(null), 2200);
    return () => clearTimeout(t);
  }, [recentlyAdvancedMatchId]);

  if (!matches || matches.length === 0) {
    return <p className="muted">No bracket generated yet.</p>;
  }

  const width = roundNumbers.length * (CARD_W + GAP_X) - GAP_X;

  // Connector lines: each match draws a stepped line from its right edge to
  // the left edge of the match it feeds into (next_match_id).
  const lines = [];
  matches.forEach((m) => {
    if (!m.next_match_id || !positions[m.id] || !positions[m.next_match_id]) return;
    const from = positions[m.id];
    const to = positions[m.next_match_id];
    const x1 = roundNumbers.indexOf(from.round) * (CARD_W + GAP_X) + CARD_W;
    const x2 = roundNumbers.indexOf(to.round) * (CARD_W + GAP_X);
    const midX = x1 + GAP_X / 2;
    const isPulsing = pulseId === m.next_match_id;

    lines.push(
      <path
        key={m.id}
        d={`M ${x1} ${from.y} H ${midX} V ${to.y} H ${x2}`}
        fill="none"
        stroke={isPulsing ? 'var(--accent)' : 'var(--border)'}
        strokeWidth={isPulsing ? 2.5 : 1.5}
        style={isPulsing ? { transition: 'stroke 0.3s ease' } : undefined}
      />
    );
  });

  return (
    <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
      <div style={{ position: 'relative', width, height: totalHeight, minHeight: totalHeight }}>
        <svg width={width} height={totalHeight} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
          {lines}
        </svg>
        {roundNumbers.map((r, ri) => (
          <div key={r} style={{ position: 'absolute', left: ri * (CARD_W + GAP_X), top: 0 }}>
            {rounds[r].map((m) => (
              <div
                key={m.id}
                style={{ position: 'absolute', top: positions[m.id].y - CARD_H / 2, width: CARD_W }}
              >
                <MatchCard match={m} onReportScore={onReportScore} canManage={canManage} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
