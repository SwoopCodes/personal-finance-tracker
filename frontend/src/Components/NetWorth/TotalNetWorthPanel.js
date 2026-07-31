import React from 'react';
import {
  PieChart, Pie, Cell, Tooltip as PieTooltip,
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const TIMEFRAMES = [
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '1y', label: '1Y' },
  { value: 'ytd', label: 'YTD' },
  { value: 'all', label: 'All' }
];

const CASH_COLOR = '#3182ce';
const INVESTMENT_COLOR = '#805ad5';

const zeroSnap = (v) => (Math.abs(v) < 0.005 ? 0 : v);
const cls = (v) => (v >= 0 ? 'positive' : 'negative');
const sign = (v) => (v >= 0 ? '+' : '');

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const TotalNetWorthPanel = ({ data, timeframe, onTimeframeChange }) => {
  const netWorth = data.netWorth ?? 0;
  const cashValue = data.cashValue ?? 0;
  const cashPct = data.cashPct ?? 0;
  const investmentValue = data.investmentValue ?? 0;
  const investmentPct = data.investmentPct ?? 0;
  const allTimeHighValue = data.allTimeHigh?.value ?? 0;
  const allTimeHighDate = data.allTimeHigh?.date;
  const allTimeLowValue = data.allTimeLow?.value ?? 0;
  const allTimeLowDate = data.allTimeLow?.date;
  const periodChangeValue = zeroSnap(data.periodChangeValue ?? 0);
  const periodChangePct = zeroSnap(data.periodChangePct ?? 0);

  const pieData = [
    { name: 'Cash', value: Math.max(cashValue, 0) },
    { name: 'Investments', value: Math.max(investmentValue, 0) }
  ];

  const mixChartData = (data.chartData || []).map(p => ({
    date: p.date,
    cashPct: p.netWorth ? (p.cash / p.netWorth) * 100 : 0,
    investmentsPct: p.netWorth ? (p.investments / p.netWorth) * 100 : 0
  }));

  return (
    <>
      <h3 className="networth-panel-title">Total Net Worth</h3>

      <div className="stats-grid">
        <div className="stats-card">
          <span className="stats-card-label">Net Worth</span>
          <span className="stats-card-value">${netWorth.toFixed(2)}</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label">Cash</span>
          <span className="stats-card-value">${cashValue.toFixed(2)} ({cashPct.toFixed(1)}%)</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label">Investments</span>
          <span className="stats-card-value">${investmentValue.toFixed(2)} ({investmentPct.toFixed(1)}%)</span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label">Period Change</span>
          <span className={`stats-card-value ${cls(periodChangeValue)}`}>
            {sign(periodChangeValue)}${periodChangeValue.toFixed(2)} ({sign(periodChangePct)}{periodChangePct.toFixed(2)}%)
          </span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label">Highest (in period)</span>
          <span className="stats-card-value positive">
            ${allTimeHighValue.toFixed(2)} <small>({allTimeHighDate ? formatDate(allTimeHighDate) : '—'})</small>
          </span>
        </div>
        <div className="stats-card">
          <span className="stats-card-label">Lowest (in period)</span>
          <span className="stats-card-value negative">
            ${allTimeLowValue.toFixed(2)} <small>({allTimeLowDate ? formatDate(allTimeLowDate) : '—'})</small>
          </span>
        </div>
      </div>

      <div className="timeframe-selector">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.value}
            className={`timeframe-btn ${timeframe === tf.value ? 'active' : ''}`}
            onClick={() => onTimeframeChange(tf.value)}
          >
            <span className="timeframe-label">{tf.label}</span>
          </button>
        ))}
      </div>

      <div className="networth-chart-section stock-chart-container">
        <h4>Cash vs. Investments</h4>
        {netWorth <= 0 ? (
          <p>No net worth to visualize yet</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  <Cell fill={CASH_COLOR} />
                  <Cell fill={INVESTMENT_COLOR} />
                </Pie>
                <PieTooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="networth-pie-legend">
              <span className="networth-pie-legend-item">
                <span className="networth-pie-legend-swatch" style={{ background: CASH_COLOR }} />
                Cash
              </span>
              <span className="networth-pie-legend-item">
                <span className="networth-pie-legend-swatch" style={{ background: INVESTMENT_COLOR }} />
                Investments
              </span>
            </div>
          </>
        )}
      </div>

      <div className="networth-chart-section stock-chart-container">
        <h4>Net Worth Over Time</h4>
        {(data.chartData || []).length === 0 ? (
          <p>No history available</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.chartData}>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} />
              <Tooltip
                formatter={(value) => `$${Number(value).toFixed(2)}`}
                labelFormatter={(label) => formatDate(label)}
              />
              <Line type="monotone" dataKey="netWorth" stroke="#d69e2e" strokeWidth={2} dot={false} name="Net Worth" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="networth-chart-section stock-chart-container">
        <h4>Asset Mix Over Time</h4>
        {mixChartData.length === 0 ? (
          <p>No history available</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={mixChartData}>
              <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} />
              <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(value) => `${Number(value).toFixed(1)}%`}
                labelFormatter={(label) => formatDate(label)}
              />
              <Area type="monotone" dataKey="cashPct" stackId="mix" stroke={CASH_COLOR} fill={CASH_COLOR} fillOpacity={0.6} name="Cash %" />
              <Area type="monotone" dataKey="investmentsPct" stackId="mix" stroke={INVESTMENT_COLOR} fill={INVESTMENT_COLOR} fillOpacity={0.6} name="Investments %" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
};

export default TotalNetWorthPanel;
