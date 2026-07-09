import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import * as tournamentService from '../services/tournamentService';

export default function PredictionLeaderboard({ tournamentId }) {
  const { socket } = useSocket();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const reload = () => tournamentService.getPredictionLeaderboard(tournamentId).then(setRows);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [tournamentId]);

  useEffect(() => {
    if (!socket) return;
    socket.on('predictions:scored', reload);
    return () => socket.off('predictions:scored', reload);
  }, [socket, tournamentId]);

  if (loading) return <div className="spinner" />;
  if (rows.length === 0) return <p className="muted">No predictions have been made yet.</p>;

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
          <th style={{ padding: '0.5rem 0' }}>#</th>
          <th>Player</th>
          <th className="mono">Points</th>
          <th className="mono">Correct / Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.user_id} style={{ borderBottom: '1px solid var(--border)' }}>
            <td className="mono muted" style={{ padding: '0.5rem 0' }}>{i + 1}</td>
            <td>{r.username}</td>
            <td className="mono" style={{ color: 'var(--accent)' }}>{r.total_points}</td>
            <td className="mono muted">{r.correct_picks} / {r.total_picks}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
