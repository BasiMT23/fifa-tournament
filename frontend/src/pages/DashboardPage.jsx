import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as tournamentService from '../services/tournamentService';

const STATUS_LABEL = {
  draft: 'Draft', seeding: 'Seeding', in_progress: 'In Progress',
  completed: 'Completed', cancelled: 'Cancelled',
};

export default function DashboardPage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tournamentService.listTournaments().then((data) => {
      setTournaments(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="container" style={{ paddingTop: '2.5rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Tournaments</h2>

      {loading && <div className="spinner" />}

      {!loading && tournaments.length === 0 && (
        <p className="muted">No tournaments yet. Organizers can create one from the nav bar.</p>
      )}

      <div style={{ display: 'grid', gap: '0.9rem' }}>
        {tournaments.map((t) => (
          <Link key={t.id} to={`/tournaments/${t.id}`}>
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>{t.name}</h3>
                <span className="muted mono" style={{ fontSize: '0.8rem' }}>
                  {t.type.replace('_', ' ')} · {t.max_participants} teams
                </span>
              </div>
              <span className="badge">{STATUS_LABEL[t.status] || t.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
