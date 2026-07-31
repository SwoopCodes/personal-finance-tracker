import React from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';
import '../Styles/Dashboard.css';

const FinanceOverview = ({ accountBalance, chartData = [], totalIncome = 0, totalExpense = 0, onExpand }) => {

  const handleClick = () => {
    onExpand();
  };

  const income = Number(totalIncome) || 0;
  const expense = Number(totalExpense) || 0;
  const netChange = income - expense;
  const netClass = netChange >= 0 ? 'positive' : 'negative';
  const netSign = netChange >= 0 ? '+' : '';

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="chart-card clickable" onClick={handleClick}>
      <h2 className="chart-title">Finance Overview</h2>
      <div className="summary-card">
        <span className="summary-label">Total Balance</span>
        <span className="summary-value">${Number(accountBalance).toFixed(2)}</span>
      </div>

      <div className="overview-mini-stats">
        <div className="mini-stat">
          <span className="mini-stat-label">Income (30d)</span>
          <span className="mini-stat-value positive">+${income.toFixed(2)}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">Expenses (30d)</span>
          <span className="mini-stat-value negative">-${expense.toFixed(2)}</span>
        </div>
        <div className="mini-stat">
          <span className="mini-stat-label">Net (30d)</span>
          <span className={`mini-stat-value ${netClass}`}>{netSign}${netChange.toFixed(2)}</span>
        </div>
      </div>

      <div className="chart-placeholder overview-sparkline">
        {chartData.length === 0 ? (
          <div className="placeholder-text">No transactions in the last 30 days</div>
        ) : (
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="overviewBalanceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3182ce" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3182ce" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(value) => `$${Number(value).toFixed(2)}`}
                labelFormatter={(label) => formatDate(label)}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#3182ce"
                strokeWidth={2}
                fill="url(#overviewBalanceFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default FinanceOverview;