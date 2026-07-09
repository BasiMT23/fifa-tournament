import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import * as matchService from '../services/matchService';
import PredictionPanel from '../components/PredictionPanel';
import CommentFeed from '../components/CommentFeed';

export default function MatchPage() {
  const { matchId } = useParams();
  const { socket, joinTournament, leaveTournament } = useSocket();
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const reload = () => matchService.getMatch(matchId).then(setMatch);

  useEffect(() => {
    setLoading(true);
    reload().finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    if (!match) return;
    joinTournament(match.tournament_id);
    return () => leaveTournament(match.tournament_id);
  }, [match?.tournament_id]);

  useEffect(() => {
    if (!socket) return;
    socket.on('match:completed', reload);
    socket.on('match:status_changed', reload);
    return () => {
      socket.off('match:completed', reload);
      socket.off('match:status_changed', reload);
    };
  }, [socket, matchId]);

  if (loading) return <div className="container" style={{ paddingTop: '3rem' }}><div className="spinner" /></div>;
  if (!match) return <div className="container" style={{ paddingTop: '3rem' }}><p className="error-text">Match not found.</p></div>;

  return (
    <div className="container" style={{ paddingTop: '2rem', maxWidth: 640 }}>
      <Link to={`/tournaments/${match.tournament_id}`} className="muted">← Back to bracket</Link>

      <div className="card" style={{ margin: '1rem 0' }}>
        <span className="muted mono" style={{ fontSize: '0.75rem' }}>ROUND {match.round}</span>
        <h2 style={{ margin: '0.4rem 0' }}>
          {match.participant1_name || 'TBD'} <span className="muted">vs</span> {match.participant2_name || 'TBD'}
        </h2>
        <span className="mono" style={{ fontSize: '1.4rem' }}>
          {match.participant1_score ?? '–'} : {match.participant2_score ?? '–'}
        </span>
        {match.status === 'live' && <span className="badge live" style={{ marginLeft: '0.75rem' }}>LIVE</span>}
        {match.status === 'completed' && <span className="badge completed" style={{ marginLeft: '0.75rem' }}>FT</span>}
      </div>

      <div style={{ display: 'grid', gap: '1.25rem' }}>
        <PredictionPanel match={match} />
        <CommentFeed matchId={match.id} tournamentId={match.tournament_id} />
      </div>
    </div>
  );
}
