import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as tournamentService from '../services/tournamentService';

const STATUS_LABEL = {
  draft: 'Draft', seeding: 'Seeding', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled',
};

export default function DashboardPage() {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tournamentService.listTournaments().then((data) => {
      setTournaments(data);
      setLoading(false);
    });
  }, []);

  const liveCount = tournaments.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '3rem' }}>
      <div className="hero-card dark" style={{ marginBottom: '2rem' }}>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="mono" style={{ fontSize: '0.75rem', opacity: 0.8, letterSpacing: '0.08em' }}>
            {liveCount > 0 ? `${liveCount} TOURNAMENT${liveCount > 1 ? 'S' : ''} LIVE NOW` : 'READY WHEN YOU ARE'}
          </span>
          <h2 style={{ fontSize: '2.2rem', margin: '0.4rem 0 0.6rem' }}>
            {user ? `WELCOME BACK, ${user.username?.toUpperCase()}` : 'EVERY BRACKET TELLS A STORY'}
          </h2>
          <p style={{ maxWidth: 480, opacity: 0.9, marginBottom: '1.25rem' }}>
            Compete, predict, draft your fantasy squad, and talk your trash in real time.
            This is where the tournament actually lives.
          </p>
          {user && ['admin', 'organizer'].includes(user.role) && (
            <Link to="/tournaments/new"><button className="primary">Start a tournament</button></Link>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1.25rem' }}>
        <h2 style={{ fontSize: '1.4rem' }}>Tournaments</h2>
        <span className="muted mono" style={{ fontSize: '0.8rem' }}>{tournaments.length} total</span>
      </div>

      {loading && <div className="spinner" />}

      {!loading && tournaments.length === 0 && (
        <p className="muted">No tournaments yet. Organizers can start one above.</p>
      )}

      <div className="card-grid">
        {tournaments.map((t, i) => (
          <Link key={t.id} to={`/tournaments/${t.id}`}>
            <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="badge" style={{ borderColor: 'var(--accent-electric)', color: 'var(--accent-electric)' }}>
                  {t.type.replace('_', ' ').toUpperCase()}
                </span>
                <span className="badge">{STATUS_LABEL[t.status] || t.status}</span>
              </div>
              <h3 style={{ fontSize: '1.3rem', lineHeight: 1.15 }}>{t.name}</h3>
              <p className="muted" style={{ fontSize: '0.85rem', margin: 0, flex: 1 }}>
                {t.max_participants} teams battling it out — brackets, predictions, and fantasy scoring all live.
              </p>
              <span className="mono" style={{ color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 700 }}>
                ENTER ARENA →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
