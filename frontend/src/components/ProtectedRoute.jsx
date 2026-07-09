import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="container" style={{ paddingTop: '3rem' }}><div className="spinner" /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="container" style={{ paddingTop: '3rem' }}>
        <p className="error-text">You don't have permission to view this page.</p>
      </div>
    );
  }
  return children;
}
