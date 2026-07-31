import React, { useState, useEffect, useRef } from 'react';
import '../FinanceOverview/Modal.css';
import './InvestmentModal.css';

const AddInvestmentModal = ({ presetTicker, presetType, onClose, onSaved }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(presetTicker ? { symbol: presetTicker, name: presetTicker } : null);
  const [type, setType] = useState(presetType || 'BUY');
  const [amountMode, setAmountMode] = useState('shares');
  const [shares, setShares] = useState('');
  const [amount, setAmount] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => {
    if (presetTicker || !query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/investments/search?q=${encodeURIComponent(query)}`,
          { credentials: 'include' }
        );
        if (res.ok) setResults(await res.json());
      } catch (err) {
        // ignore search errors, just show no results
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, presetTicker]);

  const handleSelectResult = (r) => {
    setSelected({ symbol: r.symbol, name: r.name });
    setQuery('');
    setResults([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selected) {
      setError('Please select a stock.');
      return;
    }

    const body = {
      ticker: selected.symbol,
      type
    };

    if (amountMode === 'shares') {
      const sharesNum = parseFloat(shares);
      if (isNaN(sharesNum) || sharesNum <= 0) {
        setError('Please enter a valid number of shares.');
        return;
      }
      body.shares = sharesNum;
    } else {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        setError('Please enter a valid amount.');
        return;
      }
      body.amount = amountNum;
    }

    if (customPrice.trim() !== '') {
      const priceNum = parseFloat(customPrice);
      if (isNaN(priceNum) || priceNum <= 0) {
        setError('Please enter a valid average price.');
        return;
      }
      body.customPrice = priceNum;
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/investments/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save transaction');
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
        <h3>{type === 'BUY' ? 'Add Investment' : 'Sell Shares'}</h3>
        <form onSubmit={handleSubmit}>
          {!presetType && (
            <div className="input-group">
              <label>Type</label>
              <div className="radio-group">
                <label>
                  <input type="radio" checked={type === 'BUY'} onChange={() => setType('BUY')} /> Buy
                </label>
                <label>
                  <input type="radio" checked={type === 'SELL'} onChange={() => setType('SELL')} /> Sell
                </label>
              </div>
            </div>
          )}

          {!presetTicker && (
            <div className="input-group" style={{ position: 'relative' }}>
              <label>Stock</label>
              {selected ? (
                <div className="selected-ticker-row">
                  <span>{selected.symbol} — {selected.name}</span>
                  <button type="button" className="btn-clear-ticker" onClick={() => setSelected(null)}>Change</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search by ticker or company name"
                    autoFocus
                  />
                  {results.length > 0 && (
                    <ul className="ticker-search-results">
                      {results.map(r => (
                        <li key={r.symbol} onClick={() => handleSelectResult(r)}>
                          <span className="ticker-result-symbol">{r.symbol}</span>
                          <span className="ticker-result-name">{r.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          {presetTicker && (
            <div className="input-group">
              <label>Stock</label>
              <div className="selected-ticker-row">
                <span>{presetTicker}</span>
              </div>
            </div>
          )}

          <div className="input-group">
            <label>Amount</label>
            <div className="radio-group">
              <label>
                <input type="radio" checked={amountMode === 'shares'} onChange={() => setAmountMode('shares')} /> Shares
              </label>
              <label>
                <input type="radio" checked={amountMode === 'amount'} onChange={() => setAmountMode('amount')} /> Dollar amount
              </label>
            </div>
          </div>

          {amountMode === 'shares' ? (
            <div className="input-group">
              <label>Number of Shares (fractional allowed)</label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                value={shares}
                onChange={e => setShares(e.target.value)}
                placeholder="e.g., 2.5"
                required
              />
            </div>
          ) : (
            <div className="input-group">
              <label>Dollar Amount ($)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g., 500"
                required
              />
            </div>
          )}

          {type === 'BUY' && (
            <div className="input-group">
              <label>Average Price (optional — leave blank to use live price)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={customPrice}
                onChange={e => setCustomPrice(e.target.value)}
                placeholder="e.g., 185.20"
              />
            </div>
          )}

          {error && (
            <div style={{ color: '#e53e3e', marginBottom: '1rem', textAlign: 'center' }}>{error}</div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-register" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-login" disabled={loading}>
              {loading ? 'Saving...' : (type === 'BUY' ? 'Add' : 'Sell')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddInvestmentModal;
