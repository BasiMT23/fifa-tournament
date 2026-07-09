import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../services/apiClient';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Same-origin in production (served together); in dev, Vite proxies /api
    // but Socket.io needs the real backend origin directly.
    const socket = io('/', {
      path: '/socket.io',
      auth: { token: getAccessToken() }, // optional — anonymous spectators still connect fine
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    return () => socket.disconnect();
  }, []);

  const joinTournament = (tournamentId) => socketRef.current?.emit('tournament:join', tournamentId);
  const leaveTournament = (tournamentId) => socketRef.current?.emit('tournament:leave', tournamentId);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, joinTournament, leaveTournament }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
