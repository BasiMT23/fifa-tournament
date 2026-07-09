import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import * as tournamentService from '../services/tournamentService';
import BracketView from '../components/BracketView';
import PredictionLeaderboard from '../components/PredictionLeaderboard';
import FantasyPanel from '../components/FantasyPanel';

const TABS = ['Bracket', 'Prediction Leaderboard', 'Fantasy'];

export default function TournamentPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { joinTournament, leaveTournament, socket } = useSocket();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Bracket');
  const [recentlyAdvanced, setRecentlyAdvanced] = useState(null);

  const canManage = user && ['admin', 'organizer'].includes(user.role);

  const reload = () => tournamentService.getTournament(id).then(setTournament);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    joinTournament(id);
    return () => leaveTournament(id);
  }, [id]);

  // Live updates: any of these events mean the bracket state changed server-side.
  useEffect(() => {
    if (!socket) return;
    const refresh = () => reload();
    const onAdvanced = (nextMatch) => {
      setRecentlyAdvanced(nextMatch.id);
      reload();
    };
    socket.on('match:completed', refresh);
    socket.on('bracket:generated', refresh);
    socket.on('bracket:match_advanced', onAdvanced);
    socket.on('match:status_changed', refresh);
    return () => {
      socket.off('match:completed', refresh);
      socket.off('bracket:generated', refresh);
      socket.off('bracket:match_advanced', onAdvanced);
      socket.off('match:status_changed', refresh);
    };
  }, [socket, id]);

  const handleReportScore = async (matchId, score1, score2) => {
    await tournamentService.reportScore(id, matchId, score1, score2);
    // reload happens via the match:completed socket event
  };

  if (loading) return <div className="container" style={{ paddingTop: '3rem' }}><div className="spinner" /></div>;
  if (!tournament) return <div className="container" style={{ paddingTop: '3rem' }}><p className="error-text">Tournament not found.</p></div>;

  return (
    <div className="container" style={{ paddingTop: '2rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2>{tournament.name}</h2>
        <span className="muted mono" style={{ fontSize: '0.85rem' }}>
          {tournament.type.replace('_', ' ')} · {tournament.participants?.length || 0} participants · {tournament.status}
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              border: 'none',
              borderRadius: 0,
              background: 'transparent',
              borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t ? 'var(--text)' : 'var(--text-muted)',
              padding: '0.6rem 0.2rem',
              marginRight: '1rem',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Bracket' && (
        <BracketView
          matches={tournament.matches}
          onReportScore={handleReportScore}
          canManage={canManage}
          recentlyAdvancedMatchId={recentlyAdvanced}
        />
      )}
      {tab === 'Prediction Leaderboard' && <PredictionLeaderboard tournamentId={id} />}
      {tab === 'Fantasy' && <FantasyPanel tournamentId={id} />}
    </div>
  );
}
