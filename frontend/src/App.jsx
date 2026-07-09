import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import NewTournamentPage from './pages/NewTournamentPage';
import TournamentPage from './pages/TournamentPage';
import MatchPage from './pages/MatchPage';

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route
            path="/tournaments/new"
            element={
              <ProtectedRoute roles={['admin', 'organizer']}>
                <NewTournamentPage />
              </ProtectedRoute>
            }
          />
          <Route path="/tournaments/:id" element={<ProtectedRoute><TournamentPage /></ProtectedRoute>} />
          <Route path="/matches/:matchId" element={<ProtectedRoute><MatchPage /></ProtectedRoute>} />
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
