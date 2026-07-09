import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as tournamentService from '../services/tournamentService';

export default function NewTournamentPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [tournament, setTournament] = useState(null);
  const [form, setForm] = useState({ name: '', type: 'knockout', max_participants: 8 });
  const [participantsText, setParticipantsText] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const createTournament = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await tournamentService.createTournament(form);
      setTournament(created);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create tournament');
    } finally {
      setSubmitting(false);
    }
  };

  const addParticipantsAndGenerate = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      // One participant per line, optionally "Name, skillRating"
      const participants = participantsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, rating] = line.split(',').map((s) => s.trim());
          return { name, skillRating: rating ? Number(rating) : 0 };
        });

      if (participants.length < 2) throw new Error('Add at least 2 participants');

      await tournamentService.addParticipants(tournament.id, participants);
      await tournamentService.generateBracket(tournament.id);
      navigate(`/tournaments/${tournament.id}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to set up the bracket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container" style={{ paddingTop: '2.5rem', maxWidth: 480 }}>
      <h2 style={{ marginBottom: '1.5rem' }}>New Tournament</h2>

      {step === 1 && (
        <form onSubmit={createTournament} className="form-stack">
          <label>
            Tournament name
            <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </label>
          <label>
            Format
            <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="knockout">Knockout</option>
              <option value="round_robin">Round Robin</option>
              <option value="group_knockout">Group + Knockout</option>
            </select>
          </label>
          <label>
            Max participants
            <input
              type="number" min={2} max={128} required
              value={form.max_participants}
              onChange={(e) => setForm((f) => ({ ...f, max_participants: Number(e.target.value) }))}
            />
          </label>
          {error && <span className="error-text">{error}</span>}
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Next: add participants'}
          </button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={addParticipantsAndGenerate} className="form-stack" style={{ maxWidth: 480 }}>
          <label>
            Participants (one per line — optionally <span className="mono">Name, skill rating</span>)
            <textarea
              rows={8}
              required
              placeholder={'Brazil, 95\nArgentina, 93\nFrance, 90\nEngland, 88'}
              value={participantsText}
              onChange={(e) => setParticipantsText(e.target.value)}
            />
          </label>
          <p className="muted" style={{ fontSize: '0.85rem' }}>
            Higher skill rating means a higher seed — top seeds are kept apart in early rounds.
          </p>
          {error && <span className="error-text">{error}</span>}
          <button type="submit" className="primary" disabled={submitting}>
            {submitting ? 'Generating bracket…' : 'Generate bracket'}
          </button>
        </form>
      )}
    </div>
  );
}
