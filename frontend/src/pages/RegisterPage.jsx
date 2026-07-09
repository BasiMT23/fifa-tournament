import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form.username, form.email, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '3rem' }}>
      <h2 style={{ marginBottom: '1.5rem' }}>Create Account</h2>
      <form onSubmit={submit} className="form-stack">
        <label>
          Username
          <input required minLength={3} value={form.username} onChange={update('username')} />
        </label>
        <label>
          Email
          <input type="email" required value={form.email} onChange={update('email')} />
        </label>
        <label>
          Password
          <input type="password" required minLength={8} value={form.password} onChange={update('password')} />
        </label>
        {error && <span className="error-text">{error}</span>}
        <button type="submit" className="primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>
      <p className="muted" style={{ marginTop: '1.25rem' }}>
        Already have an account? <Link to="/login" style={{ color: 'var(--accent)' }}>Log in</Link>
      </p>
    </div>
  );
}
