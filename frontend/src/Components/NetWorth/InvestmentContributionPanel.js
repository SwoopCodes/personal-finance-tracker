import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const zeroSnap = (v) => (Math.abs(v) < 0.005 ? 0 : v);
const cls = (v) => (v >= 0 ? 'positive' : 'negative');
const sign = (v) => (v >= 0 ? '+' : '');

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const InvestmentContributionPanel = ({ data }) => {
  const investmentValue = data.investmentValue ?? 0;
  const investmentPct = data.investmentPct ?? 0;
  const changeValue = zeroSnap(data.investmentPeriodChangeValue ?? 0);

  return (
    <>
      <h3 className="networth-panel-title">Investment Portfolio's Contribution to Net Worth</h3>

      <div className="stats-grid">
        <div className="stats-card">
          <span className="stats-card-label">Investment Value</span>
          <span className="stats-card-value">${investmentValue.toFixed(2)}</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label">% of Net Worth</span>
          <span className="stats-card-value">{investmentPct.toFixed(1)}%</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label">Period Change</span>
          <span className={`stats-card-value ${cls(changeValue)}`}>
            {sign(changeValue)}${changeValue.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="networth-chart-section stock-chart-container">
        <h4>Investment Value Over Time</h4>
        {(data.chartData || []).length === 0 ? (
          <p>No history available</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={data.chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="netWorthInvestFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#805ad5" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#805ad5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value) => `$${Number(value).toFixed(2)}`}
                labelFormatter={(label) => formatDate(label)}
              />
              <Area
                type="monotone"
                dataKey="investments"
                stroke="#805ad5"
                strokeWidth={2}
                fill="url(#netWorthInvestFill)"
                name="Investments"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
};

export default InvestmentContributionPanel;
