import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import AddInvestmentModal from './AddInvestmentModal';
import RecordDividendModal from './RecordDividendModal';
import './StockOverview.css';

const TIMEFRAMES = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' }
];

const StockOverview = ({ ticker, onPositionClosed }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('1m');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState('BUY');
  const [closing, setClosing] = useState(false);
  const [showDividendModal, setShowDividendModal] = useState(false);

  const fetchOverview = useCallback(async () => {
    if (!ticker) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `http://localhost:5000/api/investments/${ticker}/overview?timeframe=${timeframe}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load investment overview');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [ticker, timeframe]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleModalSaved = async () => {
    setShowAddModal(false);
    await fetchOverview();
  };

  const handleDividendSaved = async () => {
    setShowDividendModal(false);
    await fetchOverview();
  };

  const handleClose = async () => {
    if (!window.confirm(`Close your entire ${ticker} position at the current market price?`)) return;
    setClosing(true);
    try {
      const res = await fetch(`http://localhost:5000/api/investments/${ticker}/close`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to close position');
      }
      await onPositionClosed();
    } catch (err) {
      alert(err.message);
    } finally {
      setClosing(false);
    }
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (!ticker) {
    return <div className="stock-overview"><p>Select an investment to view details</p></div>;
  }
  if (loading && !data) {
    return <div className="stock-overview"><p>Loading...</p></div>;
  }
  if (error) {
    return <div className="stock-overview"><p className="error-message">{error}</p></div>;
  }
  if (!data) return null;

  const { name, currentPrice, dayChangePct, chartData, timeframeChanges, position, transactions, dividends } = data;
  const dayChangeClass = dayChangePct >= 0 ? 'positive' : 'negative';
  const unrealizedPL = Math.abs(position.unrealizedPL) < 0.005 ? 0 : position.unrealizedPL;
  const unrealizedPLPct = Math.abs(position.unrealizedPLPct) < 0.005 ? 0 : position.unrealizedPLPct;
  const plClass = unrealizedPL >= 0 ? 'positive' : 'negative';
  const paysDividend = dividends && dividends.annualRatePerShare > 0;

  return (
    <div className="stock-overview">
      <div className="stock-header">
        <div>
          <div className="stock-name-row">
            <h3>{name}</h3>
            <span className="stock-ticker-badge">{ticker}</span>
          </div>
          <div className="stock-price-row">
            <span className="stock-price">${currentPrice.toFixed(2)}</span>
            <span className={`stock-day-change ${dayChangeClass}`}>
              {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}% today
            </span>
          </div>
        </div>
        <div className="stock-header-actions">
          <button className="btn-add-funds" onClick={() => { setAddType('BUY'); setShowAddModal(true); }}>
            + Add Funds
          </button>
          <button className="btn-sell" onClick={() => { setAddType('SELL'); setShowAddModal(true); }}>
            Sell
          </button>
          <button className="btn-close-position" onClick={handleClose} disabled={closing}>
            {closing ? 'Closing...' : 'Close Position'}
          </button>
          <button className="btn-sell" onClick={() => setShowDividendModal(true)}>
            💰 Record Dividend
          </button>
        </div>
      </div>

      <div className="timeframe-selector">
        {TIMEFRAMES.map(tf => {
          const change = timeframeChanges[tf.value];
          const tfClass = change >= 0 ? 'positive' : 'negative';
          return (
            <button
              key={tf.value}
              className={`timeframe-btn ${timeframe === tf.value ? 'active' : ''}`}
              onClick={() => setTimeframe(tf.value)}
            >
              <span className="timeframe-label">{tf.label}</span>
              {change !== undefined && (
                <span className={`timeframe-change ${tfClass}`}>
                  {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="stock-chart-container">
        {chartData.length === 0 ? (
          <p>No price data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value) => `$${Number(value).toFixed(2)}`}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line type="monotone" dataKey="close" stroke="#3182ce" strokeWidth={2} dot={false} name="Price" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="position-summary">
        <div className="position-stat">
          <span className="position-stat-label">Shares Held</span>
          <span className="position-stat-value">{position.shares.toFixed(4)}</span>
        </div>
        <div className="position-stat">
          <span className="position-stat-label">Avg Cost</span>
          <span className="position-stat-value">${position.avgCost.toFixed(2)}</span>
        </div>
        <div className="position-stat">
          <span className="position-stat-label">Market Value</span>
          <span className="position-stat-value">${position.marketValue.toFixed(2)}</span>
        </div>
        <div className="position-stat">
          <span className="position-stat-label">Unrealized P/L</span>
          <span className={`position-stat-value ${plClass}`}>
            {unrealizedPL >= 0 ? '+' : ''}${unrealizedPL.toFixed(2)}
            {' '}({unrealizedPLPct >= 0 ? '+' : ''}{unrealizedPLPct.toFixed(2)}%)
          </span>
        </div>
        {paysDividend && (
          <>
            <div className="position-stat">
              <span className="position-stat-label">Dividend Yield</span>
              <span className="position-stat-value">{dividends.yieldOnPricePct.toFixed(2)}%</span>
            </div>
            <div className="position-stat">
              <span className="position-stat-label">Est. Annual Dividend Income</span>
              <span className="position-stat-value positive">
                ${dividends.estimatedAnnualIncome.toFixed(2)}
              </span>
            </div>
            <div className="position-stat">
              <span className="position-stat-label">Dividends Received to Date</span>
              <span className="position-stat-value positive">${dividends.totalReceived.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      <div className="transaction-list">
        <h4>Transactions</h4>
        {transactions.length === 0 ? (
          <p>No transactions yet</p>
        ) : (
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Shares</th>
                <th>Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(txn => (
                <tr key={txn.id}>
                  <td data-label="Date">{txn.date}</td>
                  <td data-label="Type">
                    <span className={`txn-type-badge ${txn.type === 'BUY' ? 'positive' : 'negative'}`}>
                      {txn.type}
                    </span>
                  </td>
                  <td data-label="Shares">{txn.shares.toFixed(4)}</td>
                  <td data-label="Price">${txn.pricePerShare.toFixed(2)}</td>
                  <td data-label="Total">${(txn.shares * txn.pricePerShare).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dividends && dividends.history.length > 0 && (
        <div className="transaction-list">
          <h4>Dividends Received</h4>
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Amount / Share</th>
                <th>Shares Held</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {dividends.history.map(div => (
                <tr key={div.id}>
                  <td data-label="Date">{div.date}</td>
                  <td data-label="Amount / Share">${div.amountPerShare.toFixed(4)}</td>
                  <td data-label="Shares Held">{div.sharesHeld.toFixed(4)}</td>
                  <td data-label="Total">${div.totalAmount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddInvestmentModal
          presetTicker={ticker}
          presetType={addType}
          onClose={() => setShowAddModal(false)}
          onSaved={handleModalSaved}
        />
      )}
      {showDividendModal && (
        <RecordDividendModal
          presetTicker={ticker}
          onClose={() => setShowDividendModal(false)}
          onSaved={handleDividendSaved}
        />
      )}
    </div>
  );
};

export default StockOverview;
