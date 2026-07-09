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
    <header style={{ borderBottom: '1px solid var(--border)', background: 'rgba(18, 22, 29, 0.85)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 10 }}>
      <nav className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 68 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
          <h1 style={{ fontSize: '1.5rem', letterSpacing: '0.03em' }}>MATCHDAY</h1>
          <span
            className="mono"
            title={connected ? 'Live updates connected' : 'Reconnecting…'}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: connected ? 'var(--accent)' : 'var(--danger)',
              display: 'inline-block',
              boxShadow: connected ? '0 0 8px var(--accent)' : 'none',
            }}
          />
        </Link>

        <div style={{ display: 'flex', gap: '1.75rem', alignItems: 'center' }}>
          {user ? (
            <>
              <Link to="/" className="muted" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Tournaments</Link>
              {(user.role === 'organizer' || user.role === 'admin') && (
                <Link to="/tournaments/new"><button className="primary">New Tournament</button></Link>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span className="avatar">{user.username?.[0]?.toUpperCase()}</span>
                <button className="ghost" onClick={handleLogout}>Log out</button>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="muted" style={{ fontWeight: 600, fontSize: '0.9rem' }}>Log in</Link>
              <Link to="/register"><button className="primary">Sign up</button></Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
