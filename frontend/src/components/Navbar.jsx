import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
      <nav className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h1 style={{ fontSize: '1.4rem', letterSpacing: '0.03em' }}>MATCHDAY</h1>
          <span
            className="mono"
            title={connected ? 'Live updates connected' : 'Reconnecting…'}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? 'var(--accent)' : 'var(--danger)',
              display: 'inline-block',
            }}
          />
        </Link>

        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          {user ? (
            <>
              <Link to="/" className="muted">Tournaments</Link>
              {(user.role === 'organizer' || user.role === 'admin') && (
                <Link to="/tournaments/new" className="muted">New Tournament</Link>
              )}
              <span className="mono muted" style={{ fontSize: '0.85rem' }}>{user.username}</span>
              <button onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="muted">Log in</Link>
              <Link to="/register"><button className="primary">Sign up</button></Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
