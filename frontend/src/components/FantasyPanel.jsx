import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as fantasyService from '../services/fantasyService';

const BUDGET_CAP = 100.0;
const POSITIONS = ['GK', 'DEF', 'MID', 'FWD'];

export default function FantasyPanel({ tournamentId }) {
  const { user } = useAuth();
  const [team, setTeam] = useState(undefined); // undefined = loading, null = no team yet
  const [leaderboard, setLeaderboard] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [draft, setDraft] = useState({ externalPlayerId: '', playerName: '', position: 'MID', realTeam: '', price: '' });
  const [error, setError] = useState(null);

  const reload = () => {
    fantasyService.getMyTeam(tournamentId).then(setTeam);
    fantasyService.getFantasyLeaderboard(tournamentId).then(setLeaderboard);
  };

  useEffect(() => { if (user) reload(); }, [tournamentId, user]);

  if (!user) return <p className="muted">Log in to build a fantasy team for this tournament.</p>;
  if (team === undefined) return <div className="spinner" />;

  const createTeam = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await fantasyService.createFantasyTeam(tournamentId, teamName);
      reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create team');
    }
  };

  const submitDraft = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await fantasyService.draftPlayer(team.id, { ...draft, price: Number(draft.price) });
      setDraft({ externalPlayerId: '', playerName: '', position: 'MID', realTeam: '', price: '' });
      reload();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to draft player');
    }
  };

  const remaining = team ? BUDGET_CAP - team.players.reduce((sum, p) => sum + Number(p.price), 0) : BUDGET_CAP;

  return (
    <div style={{ display: 'grid', gap: '1.5rem' }}>
      {!team && (
        <form onSubmit={createTeam} className="form-stack">
          <label>
            Fantasy team name
            <input required value={teamName} onChange={(e) => setTeamName(e.target.value)} />
          </label>
          {error && <span className="error-text">{error}</span>}
          <button type="submit" className="primary">Create team</button>
        </form>
      )}

      {team && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <h3 style={{ fontSize: '1.05rem' }}>{team.team_name}</h3>
            <span className="mono">
              £{remaining.toFixed(1)} left · {team.players.length}/15 players · {team.total_points} pts
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
            {team.players.map((p) => (
              <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span>
                  {p.is_captain && '© '}{p.player_name} <span className="muted mono">{p.position}</span>
                </span>
                <span className="mono muted">£{Number(p.price).toFixed(1)}</span>
              </div>
            ))}
            {team.players.length === 0 && <p className="muted">No players drafted yet.</p>}
          </div>

          <form onSubmit={submitDraft} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr' }}>
            <input placeholder="Player name" required value={draft.playerName}
              onChange={(e) => setDraft((d) => ({ ...d, playerName: e.target.value }))} />
            <input placeholder="External ID" required value={draft.externalPlayerId}
              onChange={(e) => setDraft((d) => ({ ...d, externalPlayerId: e.target.value }))} />
            <select value={draft.position} onChange={(e) => setDraft((d) => ({ ...d, position: e.target.value }))}>
              {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <input placeholder="Real team" value={draft.realTeam}
              onChange={(e) => setDraft((d) => ({ ...d, realTeam: e.target.value }))} />
            <input type="number" step="0.1" min="0" placeholder="Price" required value={draft.price}
              onChange={(e) => setDraft((d) => ({ ...d, price: e.target.value }))} />
            <button type="submit" className="primary">Draft player</button>
          </form>
          {error && <p className="error-text">{error}</p>}
        </div>
      )}

      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Fantasy Leaderboard</h3>
        {leaderboard.length === 0 && <p className="muted">No fantasy teams yet.</p>}
        {leaderboard.map((row, i) => (
          <div key={row.team_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
            <span className="mono muted">{i + 1}</span>
            <span>{row.team_name} <span className="muted">({row.username})</span></span>
            <span className="mono" style={{ color: 'var(--accent)' }}>{row.total_points}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
