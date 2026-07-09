import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import * as commentService from '../services/commentService';

export default function CommentFeed({ matchId, tournamentId }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    commentService.listComments(matchId).then((data) => {
      if (active) { setComments(data); setLoading(false); }
    });
    return () => { active = false; };
  }, [matchId]);

  useEffect(() => {
    if (!socket) return;
    const onNew = (comment) => {
      if (comment.matchId === Number(matchId) || comment.match_id === Number(matchId)) {
        setComments((prev) => [...prev, comment]);
      }
    };
    const onDeleted = ({ commentId, matchId: mid }) => {
      if (mid === Number(matchId)) {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
      }
    };
    socket.on('comment:new', onNew);
    socket.on('comment:deleted', onDeleted);
    return () => {
      socket.off('comment:new', onNew);
      socket.off('comment:deleted', onDeleted);
    };
  }, [socket, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [comments.length]);

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    const content = text;
    setText('');
    try {
      await commentService.postComment(matchId, content);
      // Own comment arrives back via the socket broadcast — no need to append locally.
    } catch {
      setText(content); // restore on failure so nothing's lost
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h3 style={{ fontSize: '1rem' }}>Match Chat</h3>

      <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {loading && <div className="spinner" />}
        {!loading && comments.length === 0 && <p className="muted">No comments yet — say something.</p>}
        {comments.map((c) => (
          <div key={c.id} style={{ fontSize: '0.9rem' }}>
            <span className="mono" style={{ color: 'var(--accent)' }}>{c.username}</span>{' '}
            <span>{c.content}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {user ? (
        <form onSubmit={submit} style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Talk some trash…"
            maxLength={500}
            style={{ flex: 1 }}
          />
          <button type="submit" className="primary">Send</button>
        </form>
      ) : (
        <p className="muted">Log in to join the chat.</p>
      )}
    </div>
  );
}
