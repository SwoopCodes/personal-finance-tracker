import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const TIMEFRAMES = [
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' }
];

const zeroSnap = (v) => (Math.abs(v) < 0.005 ? 0 : v);

const StatisticsPanel = ({ onClose }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeframe, setTimeframe] = useState('1m');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/investments/stats?timeframe=${timeframe}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to load statistics');
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="statistics-overlay">
      <div className="statistics-header">
        <h3>Portfolio Statistics</h3>
        <button className="btn-close" onClick={onClose}>✕</button>
      </div>

      <div className="statistics-body">
        {loading && <p>Loading...</p>}
        {error && <p className="error-message">{error}</p>}
        {data && (
          <>
            {(() => {
              const unrealizedPL = zeroSnap(data.unrealizedPL);
              const realizedPL = zeroSnap(data.realizedPL);
              const totalPL = zeroSnap(data.totalPL);
              const totalPLPct = zeroSnap(data.totalPLPct);
              const dayChangeValue = zeroSnap(data.dayChangeValue);
              const dayChangePct = zeroSnap(data.dayChangePct);
              const cls = (v) => (v >= 0 ? 'positive' : 'negative');
              const sign = (v) => (v >= 0 ? '+' : '');

              return (
                <div className="stats-grid">
                  <div className="stats-card">
                    <span className="stats-card-label">Total Portfolio Value</span>
                    <span className="stats-card-value">${data.totalValue.toFixed(2)}</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Total Invested (Cost Basis)</span>
                    <span className="stats-card-value">${data.totalInvested.toFixed(2)}</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Day Change</span>
                    <span className={`stats-card-value ${cls(dayChangeValue)}`}>
                      {sign(dayChangeValue)}${dayChangeValue.toFixed(2)} ({sign(dayChangePct)}{dayChangePct.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Unrealized P/L</span>
                    <span className={`stats-card-value ${cls(unrealizedPL)}`}>
                      {sign(unrealizedPL)}${unrealizedPL.toFixed(2)} ({sign(data.unrealizedPLPct)}{data.unrealizedPLPct.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Realized P/L</span>
                    <span className={`stats-card-value ${cls(realizedPL)}`}>
                      {sign(realizedPL)}${realizedPL.toFixed(2)}
                    </span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Total P/L (Realized + Unrealized)</span>
                    <span className={`stats-card-value ${cls(totalPL)}`}>
                      {sign(totalPL)}${totalPL.toFixed(2)} ({sign(totalPLPct)}{totalPLPct.toFixed(2)}%)
                    </span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Total Dividends Earned</span>
                    <span className="stats-card-value positive">
                      ${data.totalDividendsEarned.toFixed(2)}
                    </span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Portfolio Dividend Yield</span>
                    <span className="stats-card-value">{data.portfolioDividendYieldPct.toFixed(2)}%</span>
                  </div>
                  <div className="stats-card">
                    <span className="stats-card-label">Open Positions</span>
                    <span className="stats-card-value">{data.numPositions}</span>
                  </div>
                  {data.bestPerformer && (
                    <div className="stats-card">
                      <span className="stats-card-label">Best Performer</span>
                      <span className="stats-card-value positive">
                        {data.bestPerformer.ticker} (+{data.bestPerformer.unrealizedPLPct.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                  {data.worstPerformer && (
                    <div className="stats-card">
                      <span className="stats-card-label">Worst Performer</span>
                      <span className="stats-card-value negative">
                        {data.worstPerformer.ticker} ({data.worstPerformer.unrealizedPLPct.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="timeframe-selector">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  className={`timeframe-btn ${timeframe === tf.value ? 'active' : ''}`}
                  onClick={() => setTimeframe(tf.value)}
                >
                  <span className="timeframe-label">{tf.label}</span>
                </button>
              ))}
            </div>

            <div className="stock-chart-container">
              {data.chartData.length === 0 ? (
                <p>No value history available</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={data.chartData}>
                    <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" />
                    <YAxis domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={(value) => `$${Number(value).toFixed(2)}`}
                      labelFormatter={(label) => formatDate(label)}
                    />
                    <Line type="monotone" dataKey="value" stroke="#3182ce" strokeWidth={2} dot={false} name="Value" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StatisticsPanel;
