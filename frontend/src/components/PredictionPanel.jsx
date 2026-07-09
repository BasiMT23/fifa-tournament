import { useEffect, useState } from 'react';
import * as predictionService from '../services/predictionService';

export default function PredictionPanel({ match }) {
  const [ownPrediction, setOwnPrediction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const predictable = match.status === 'scheduled' && match.participant1_id && match.participant2_id;

  useEffect(() => {
    let active = true;
    predictionService.getMatchPredictions(match.id).then(({ data }) => {
      if (!active) return;
      setOwnPrediction(data[0] || null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [match.id]);

  const pick = async (predictedWinnerId) => {
    setSaving(true);
    setError(null);
    try {
      const prediction = await predictionService.submitPrediction(match.id, predictedWinnerId);
      setOwnPrediction(prediction);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save your pick');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="spinner" />;

  return (
    <div className="card">
      <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Your Prediction</h3>

      {!predictable && (
        <p className="muted">
          {match.status === 'completed'
            ? 'This match is over.'
            : 'Predictions open once both teams in this match are known.'}
        </p>
      )}

      {predictable && (
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <PickButton
            label={match.participant1_name}
            selected={ownPrediction?.predicted_winner_id === match.participant1_id}
            onClick={() => pick(match.participant1_id)}
            disabled={saving}
          />
          <PickButton
            label={match.participant2_name}
            selected={ownPrediction?.predicted_winner_id === match.participant2_id}
            onClick={() => pick(match.participant2_id)}
            disabled={saving}
          />
        </div>
      )}

      {ownPrediction && (
        <p className="muted mono" style={{ fontSize: '0.8rem', marginTop: '0.6rem' }}>
          Worth {Math.pow(2, match.round - 1)} pts if correct
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function PickButton({ label, selected, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={selected ? 'primary no-arrow' : undefined}
      style={{ flex: 1 }}
    >
      {label}
    </button>
  );
}
