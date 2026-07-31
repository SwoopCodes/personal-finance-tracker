import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import '../Styles/Dashboard.css';

const NetWorth = ({ netWorth = 0, cashValue = 0, investmentValue = 0, chartData = [], onExpand }) => {
  const handleClick = () => {
    onExpand();
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="chart-card clickable networth-card" onClick={handleClick}>
      <h2 className="chart-title">Net Worth</h2>
      <div className="summary-card">
        <span className="summary-label">Total Net Worth</span>
        <span className="summary-value">${Number(netWorth).toFixed(2)}</span>
      </div>

      <div className="overview-mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-label">Cash</span>
          <span className="mini-stat-value">${Number(cashValue).toFixed(2)}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">Investments</span>
          <span className="mini-stat-value">${Number(investmentValue).toFixed(2)}</span>
        </div>
      </div>

      <div className="chart-placeholder overview-sparkline">
        {chartData.length === 0 ? (
          <div className="placeholder-text">No history yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d69e2e" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#d69e2e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(value) => `$${Number(value).toFixed(2)}`}
                labelFormatter={(label) => formatDate(label)}
              />
              <Area
                type="monotone"
                dataKey="netWorth"
                stroke="#d69e2e"
                strokeWidth={2}
                fill="url(#netWorthFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default NetWorth;
