import React, { useState, useEffect, useRef } from 'react';
import '../FinanceOverview/Modal.css';
import './InvestmentModal.css';

const todayIso = () => new Date().toISOString().slice(0, 10);

const RecordDividendModal = ({ presetTicker, onClose, onSaved }) => {
  const [date, setDate] = useState(todayIso());
  const [amountPerShare, setAmountPerShare] = useState('');
  const [sharesHeld, setSharesHeld] = useState(0);
  const [loading, setLoading] = useState(false);
  const [estimating, setEstimating] = useState(false);
  const [error, setError] = useState('');
  const lastFetchedDate = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const fetchEstimate = async () => {
      setEstimating(true);
      try {
        const params = new URLSearchParams({ date });
        const res = await fetch(
          `http://localhost:5000/api/investments/${presetTicker}/dividend-estimate?${params.toString()}`,
          { credentials: 'include' }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setSharesHeld(data.sharesHeld || 0);
        // Only overwrite the amount when the date actually changed, so we
        // don't clobber a value the user has already started editing.
        if (lastFetchedDate.current !== date) {
          setAmountPerShare(data.estimatedAmountPerShare ? data.estimatedAmountPerShare.toFixed(4) : '');
          lastFetchedDate.current = date;
        }
      } catch (err) {
        // leave whatever the user has typed so far
      } finally {
        if (!cancelled) setEstimating(false);
      }
    };
    fetchEstimate();
    return () => { cancelled = true; };
  }, [presetTicker, date]);

  const amountNum = parseFloat(amountPerShare) || 0;
  const totalAmount = amountNum * sharesHeld;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const priceNum = parseFloat(amountPerShare);
    if (isNaN(priceNum) || priceNum <= 0) {
      setError('Please enter a valid amount per share.');
      return;
    }

    const body = { ticker: presetTicker, date, amountPerShare: priceNum };

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/investments/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to record dividend');
      }
      await onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Record Dividend</h3>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Stock</label>
            <div className="selected-ticker-row">
              <span>{presetTicker}</span>
            </div>
          </div>

          <div className="input-group">
            <label>Payment Date</label>
            <input
              type="date"
              value={date}
              max={todayIso()}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label>
              Amount per Share ($){estimating ? ' — loading suggestion...' : ''}
            </label>
            <input
              type="number"
              step="0.0001"
              min="0.0001"
              value={amountPerShare}
              onChange={e => setAmountPerShare(e.target.value)}
              placeholder="e.g., 0.27"
              required
            />
          </div>

          <p style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
            {sharesHeld.toFixed(4)} shares held as of this date &mdash; total: ${totalAmount.toFixed(2)}
          </p>

          {error && (
            <div style={{ color: '#e53e3e', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-register" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-login" disabled={loading || sharesHeld <= 0}>
              {loading ? 'Saving...' : 'Record Dividend'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RecordDividendModal;
