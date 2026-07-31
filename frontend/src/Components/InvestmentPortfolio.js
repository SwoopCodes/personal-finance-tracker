import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import '../Styles/Dashboard.css';

const InvestmentPortfolio = ({ totalValue = 0, totalInvested = 0, totalPL = 0, totalPLPct = 0, chartData = [], onExpand }) => {
  const handleClick = () => {
    onExpand();
  };

  const pl = Math.abs(totalPL) < 0.005 ? 0 : totalPL;
  const plPct = Math.abs(totalPLPct) < 0.005 ? 0 : totalPLPct;
  const plClass = pl >= 0 ? 'positive' : 'negative';
  const plSign = pl >= 0 ? '+' : '';

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="chart-card clickable" onClick={handleClick}>
      <h2 className="chart-title">Investment Portfolio</h2>
      <div className="summary-card">
        <span className="summary-label">Total Value</span>
        <span className="summary-value">${totalValue.toFixed(2)}</span>
      </div>

      <div className="overview-mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-label">Invested</span>
          <span className="mini-stat-value">${totalInvested.toFixed(2)}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">P/L</span>
          <span className={`mini-stat-value ${plClass}`}>{plSign}${pl.toFixed(2)}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">P/L %</span>
          <span className={`mini-stat-value ${plClass}`}>{plSign}{plPct.toFixed(2)}%</span>
        </div>
      </div>

      <div className="chart-placeholder overview-sparkline">
        {chartData.length === 0 || totalValue === 0 ? (
          <div className="placeholder-text">No investments tracked yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="investmentValueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#805ad5" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#805ad5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(value) => `$${Number(value).toFixed(2)}`}
                labelFormatter={(label) => formatDate(label)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#805ad5"
                strokeWidth={2}
                fill="url(#investmentValueFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default InvestmentPortfolio;
