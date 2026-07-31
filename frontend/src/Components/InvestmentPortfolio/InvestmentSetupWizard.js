import React, { useState, useRef } from 'react';
import '../FinanceOverview/Modal.css';
import './InvestmentModal.css';
import './InvestmentSetupWizard.css';

const emptyAlloc = () => ({ mode: 'amount', value: '', customPrice: '' });

const InvestmentSetupWizard = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState('select'); // select | allocate | confirm
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedStocks, setSelectedStocks] = useState([]); // [{symbol, name}]
  const [allocations, setAllocations] = useState({}); // ticker -> {mode, value, customPrice}

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const handleQueryChange = (value) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `http://localhost:5000/api/investments/search?q=${encodeURIComponent(value)}`,
          { credentials: 'include' }
        );
        if (res.ok) setResults(await res.json());
      } catch (err) {
        // ignore
      }
    }, 300);
  };

  const addStock = (r) => {
    if (selectedStocks.some(s => s.symbol === r.symbol)) return;
    setSelectedStocks(prev => [...prev, { symbol: r.symbol, name: r.name }]);
    setQuery('');
    setResults([]);
  };

  const removeStock = (symbol) => {
    setSelectedStocks(prev => prev.filter(s => s.symbol !== symbol));
  };

  // ---- Step navigation ----
  const goToAllocate = () => {
    if (selectedStocks.length === 0) {
      setError('Add at least one stock to continue.');
      return;
    }
    setError('');
    const initial = {};
    selectedStocks.forEach(s => {
      initial[s.symbol] = emptyAlloc();
    });
    setAllocations(initial);
    setStep('allocate');
  };

  const updateAllocation = (symbol, field, value) => {
    setAllocations(prev => ({
      ...prev,
      [symbol]: { ...prev[symbol], [field]: value }
    }));
  };

  const goToConfirm = () => {
    for (const s of selectedStocks) {
      const alloc = allocations[s.symbol];
      const num = parseFloat(alloc.value);
      if (isNaN(num) || num <= 0) {
        setError(`Enter a valid ${alloc.mode === 'shares' ? 'share count' : 'amount'} for ${s.symbol}.`);
        return;
      }
    }
    setError('');
    setStep('confirm');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      for (const s of selectedStocks) {
        const alloc = allocations[s.symbol];
        const body = { ticker: s.symbol, type: 'BUY' };
        if (alloc.mode === 'shares') body.shares = parseFloat(alloc.value);
        else body.amount = parseFloat(alloc.value);
        if (alloc.customPrice && alloc.customPrice.trim() !== '') {
          body.customPrice = parseFloat(alloc.customPrice);
        }
        const res = await fetch('http://localhost:5000/api/investments/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(`${s.symbol}: ${err.error || 'Failed to add'}`);
        }
      }

      await onComplete();
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="investment-wizard">
      <div className="wizard-steps-indicator">
        <span className={step === 'select' ? 'active' : ''}>1. Select Stocks</span>
        <span className={step === 'allocate' ? 'active' : ''}>2. Allocate</span>
        <span className={step === 'confirm' ? 'active' : ''}>3. Confirm</span>
      </div>

      {error && <div className="wizard-error">{error}</div>}

      {step === 'select' && (
        <div className="wizard-step">
          <p className="wizard-intro">Search for one or more stocks you already own to start tracking your real portfolio.</p>
          <h4 className="wizard-subsection-title">Individual Stocks</h4>
          <div className="input-group" style={{ position: 'relative' }}>
            <input
              type="text"
              value={query}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Search by ticker or company name"
              autoFocus
            />
            {results.length > 0 && (
              <ul className="ticker-search-results">
                {results.map(r => (
                  <li key={r.symbol} onClick={() => addStock(r)}>
                    <span className="ticker-result-symbol">{r.symbol}</span>
                    <span className="ticker-result-name">{r.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedStocks.length > 0 && (
            <ul className="wizard-selected-list">
              {selectedStocks.map(s => (
                <li key={s.symbol}>
                  <span>{s.symbol} — {s.name}</span>
                  <button type="button" onClick={() => removeStock(s.symbol)}>×</button>
                </li>
              ))}
            </ul>
          )}

          <div className="wizard-actions">
            <button className="btn btn-register" onClick={onCancel}>Cancel</button>
            <button className="btn btn-login" onClick={goToAllocate}>Next →</button>
          </div>
        </div>
      )}

      {step === 'allocate' && (
        <div className="wizard-step">
          <p className="wizard-intro">Enter how many shares (or how much money) you hold for each stock — fractional shares are fine.</p>

          {selectedStocks.length > 0 && <h4 className="wizard-subsection-title">Individual Stocks</h4>}
          {selectedStocks.map(s => {
            const alloc = allocations[s.symbol] || emptyAlloc();
            return (
              <div className="wizard-allocation-card" key={s.symbol}>
                <div className="wizard-allocation-header">{s.symbol} — {s.name}</div>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      checked={alloc.mode === 'shares'}
                      onChange={() => updateAllocation(s.symbol, 'mode', 'shares')}
                    /> Shares
                  </label>
                  <label>
                    <input
                      type="radio"
                      checked={alloc.mode === 'amount'}
                      onChange={() => updateAllocation(s.symbol, 'mode', 'amount')}
                    /> Dollar amount
                  </label>
                </div>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  value={alloc.value}
                  onChange={e => updateAllocation(s.symbol, 'value', e.target.value)}
                  placeholder={alloc.mode === 'shares' ? 'e.g., 2.5 shares' : 'e.g., 500'}
                />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={alloc.customPrice}
                  onChange={e => updateAllocation(s.symbol, 'customPrice', e.target.value)}
                  placeholder="Average price paid (optional, leave blank for live price)"
                />
              </div>
            );
          })}

          <div className="wizard-actions">
            <button className="btn btn-register" onClick={() => setStep('select')}>← Back</button>
            <button className="btn btn-login" onClick={goToConfirm}>Next →</button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="wizard-step">
          <p className="wizard-intro">Review and confirm your starting positions.</p>
          {selectedStocks.length > 0 && (
            <ul className="wizard-confirm-list">
              {selectedStocks.map(s => {
                const alloc = allocations[s.symbol];
                return (
                  <li key={s.symbol}>
                    <span className="wizard-confirm-ticker">{s.symbol}</span>
                    <span>
                      {alloc.mode === 'shares' ? `${alloc.value} shares` : `$${alloc.value}`}
                      {alloc.customPrice ? ` @ $${alloc.customPrice}` : ' @ live price'}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="wizard-actions">
            <button className="btn btn-register" onClick={() => setStep('allocate')} disabled={submitting}>← Back</button>
            <button className="btn btn-login" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Creating...' : 'Confirm & Start Tracking'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvestmentSetupWizard;
