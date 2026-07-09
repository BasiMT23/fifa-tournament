import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function MatchCard({ match, onReportScore, canManage }) {
  const [editing, setEditing] = useState(false);
  const [s1, setS1] = useState(match.participant1_score ?? '');
  const [s2, setS2] = useState(match.participant2_score ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const p1 = match.participant1_name || 'TBD';
  const p2 = match.participant2_name || 'TBD';
  const canReport = canManage && match.participant1_id && match.participant2_id && match.status !== 'completed';

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onReportScore(match.id, Number(s1), Number(s2));
      setEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to report score');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="card"
      style={{
        padding: '0.6rem 0.8rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        borderColor: match.winner_id ? 'var(--accent-dim)' : 'var(--border)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted mono" style={{ fontSize: '0.7rem' }}>ROUND {match.round}</span>
        {match.status === 'live' && <span className="badge live">LIVE</span>}
        {match.status === 'completed' && <span className="badge completed">FT</span>}
      </div>

      <Row name={p1} score={match.participant1_score} isWinner={match.winner_id === match.participant1_id} />
      <Row name={p2} score={match.participant2_score} isWinner={match.winner_id === match.participant2_id} />

      {canReport && !editing && (
        <button onClick={() => setEditing(true)} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
          Report score
        </button>
      )}

      {editing && (
        <form onSubmit={submit} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input
            type="number" min="0" required value={s1} onChange={(e) => setS1(e.target.value)}
            style={{ width: 48, padding: '0.3rem' }}
          />
          <span className="muted">–</span>
          <input
            type="number" min="0" required value={s2} onChange={(e) => setS2(e.target.value)}
            style={{ width: 48, padding: '0.3rem' }}
          />
          <button type="submit" className="primary" disabled={submitting} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
            Save
          </button>
        </form>
      )}
      {error && <span className="error-text" style={{ fontSize: '0.75rem' }}>{error}</span>}

      <Link to={`/matches/${match.id}`} className="muted" style={{ fontSize: '0.7rem' }}>
        Comments & predictions →
      </Link>
    </div>
  );
}

function Row({ name, score, isWinner }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: isWinner ? 700 : 400 }}>
      <span style={{ color: isWinner ? 'var(--accent)' : 'inherit' }}>{name}</span>
      <span className="mono">{score ?? '–'}</span>
    </div>
  );
}
