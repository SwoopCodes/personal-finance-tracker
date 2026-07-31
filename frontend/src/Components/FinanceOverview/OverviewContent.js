import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import AddTransactionModal from './AddTransactionModal';
import { getCategoryColor } from './categories';
import './OverviewContent.css';

const OverviewContent = ({ accountId, accounts, onTransactionAdded, onUpdateAccountBalance, refreshAccounts }) => {
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [timeframe, setTimeframe] = useState('1m');
  const [chartType, setChartType] = useState('line');
  const [chartData, setChartData] = useState([]);
  const [totalIncome, setTotalIncome] = useState(0);
  const [totalExpense, setTotalExpense] = useState(0);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [dataLoading, setDataLoading] = useState(false);
  const [chartError, setChartError] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const closeTimerRef = useRef(null);

  const timeframeOptions = [
    { value: '1d', label: '1 Day' },
    { value: '1w', label: '1 Week' },
    { value: '1m', label: '1 Month' },
    { value: '3m', label: '3 Months' },
    { value: '1y', label: '1 Year' },
    { value: 'ytd', label: 'Year to Date' },
    { value: 'all', label: 'All Time' }
  ];

  // The line chart is unreadable at 1-day resolution (1-2 zero-filled points),
  // so it's hidden from the dropdown while in line mode; the bar chart can
  // still show it meaningfully.
  const visibleTimeframeOptions = chartType === 'line'
    ? timeframeOptions.filter(opt => opt.value !== '1d')
    : timeframeOptions;

  const handleDropdownEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setDropdownOpen(true);
  };

  const handleDropdownLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setDropdownOpen(false);
    }, 300);
  };

  const toggleDropdown = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setDropdownOpen(prev => !prev);
  };

  const fetchChartData = useCallback(async () => {
    if (!accountId) return;
    setDataLoading(true);
    setChartError(null);
    try {
      const res = await fetch(
        `http://localhost:5000/api/finance/chart-data?account_id=${accountId}&timeframe=${timeframe}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to fetch chart data');
      const data = await res.json();

      const parsedChartData = (data.chartData || []).map(item => ({
        date: item.date,
        income: parseFloat(item.income) || 0,
        expense: parseFloat(item.expense) || 0,
        balance: parseFloat(item.balance) || 0
      }));

      setChartData(parsedChartData);
      setTotalIncome(parseFloat(data.totalIncome) || 0);
      setTotalExpense(parseFloat(data.totalExpense) || 0);
      setCurrentBalance(parseFloat(data.currentBalance) || 0);
    } catch (err) {
      console.error(err);
      setChartError('Failed to load chart data. Please try again.');
    } finally {
      setDataLoading(false);
    }
  }, [accountId, timeframe]);

  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);

  const fetchTransactions = useCallback(async () => {
    if (!accountId) return;
    setTransactionsLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/transactions?account_id=${accountId}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setTransactionsLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleAddTransaction = async (type, description, amount, category) => {
    try {
      const res = await fetch('http://localhost:5000/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          account_id: accountId,
          type,
          description,
          category,
          amount: Math.abs(amount)
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add transaction');
      }
      await fetchTransactions();
      await fetchChartData();
      await refreshAccounts(); // update sidebar balance
      setShowAddTxn(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteTransaction = async (transactionId, amount) => {
  if (!window.confirm('Delete this transaction?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/transactions/${transactionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete transaction');
      }
      // Refresh transactions and chart data
      await fetchTransactions();
      await fetchChartData();
      // Refresh the entire accounts list to get the updated balance
      await refreshAccounts();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTimeframeChange = (value) => {
    setTimeframe(value);
  };

  const toggleChartType = () => {
    setChartType(prev => {
      const next = prev === 'line' ? 'bar' : 'line';
      if (next === 'line' && timeframe === '1d') {
        setTimeframe('1w');
      }
      return next;
    });
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="overview-content">
      <div className="overview-header">
        <h3>Overview</h3>
        <button className="btn-add-transaction" onClick={() => setShowAddTxn(true)}>+ Add Transaction</button>
      </div>

      {!accountId ? (
        <p>Select an account to view details</p>
      ) : (
        <>
          <div className="balance-summary">
            <div className="balance-display">
              <span className="balance-label">Current Balance</span>
              <span className="balance-value">${(currentBalance || 0).toFixed(2)}</span>
            </div>
            <div className="summary-stats">
              <div className="stat">
                <span className="stat-label">Income ({timeframeOptions.find(t => t.value === timeframe)?.label})</span>
                <span className="stat-value positive">+${(totalIncome || 0).toFixed(2)}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Expenses ({timeframeOptions.find(t => t.value === timeframe)?.label})</span>
                <span className="stat-value negative">-${(totalExpense || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="chart-controls">
            <div 
              className="dropdown"
              onMouseEnter={handleDropdownEnter}
              onMouseLeave={handleDropdownLeave}
            >
              <button 
                className="dropdown-toggle" 
                onClick={toggleDropdown}
              >
                {timeframeOptions.find(t => t.value === timeframe)?.label || 'Select timeframe'}
                <span className="dropdown-arrow">▾</span>
              </button>
              {dropdownOpen && (
                <div className="dropdown-menu">
                  {visibleTimeframeOptions.map(opt => (
                    <button
                      key={opt.value}
                      className={`dropdown-item ${timeframe === opt.value ? 'active' : ''}`}
                      onClick={() => {
                        handleTimeframeChange(opt.value);
                        setDropdownOpen(false);
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="btn-toggle-chart" onClick={toggleChartType}>
              Switch to {chartType === 'line' ? 'Bar' : 'Line'} Chart
            </button>
          </div>

          <div className="chart-container">
            {chartError ? (
              <p className="error-message">{chartError}</p>
            ) : dataLoading ? (
              <p>Loading chart...</p>
            ) : chartData.length === 0 ? (
              <p>No transactions in this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                {chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `$${Number(value).toFixed(2)}`}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#38a169" strokeWidth={2} dot={false} name="Income" />
                    <Line type="monotone" dataKey="expense" stroke="#e53e3e" strokeWidth={2} dot={false} name="Expenses" />
                    <Line type="monotone" dataKey="balance" stroke="#3182ce" strokeWidth={2} dot={false} name="Balance" />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.5} />
                    <XAxis dataKey="date" tickFormatter={formatDate} interval="preserveStartEnd" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => `$${Number(value).toFixed(2)}`}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Legend />
                    <Bar dataKey="income" fill="#38a169" name="Income" />
                    <Bar dataKey="expense" fill="#e53e3e" name="Expenses" />
                    <Bar dataKey="balance" fill="#3182ce" name="Balance" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            )}
          </div>

          <div className="transaction-list">
            <h4>Recent Transactions</h4>
            {transactionsLoading ? (
              <p>Loading transactions...</p>
            ) : transactions.length === 0 ? (
              <p>No transactions yet</p>
            ) : (
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 10).map(txn => (
                    <tr key={txn.id}>
                      <td data-label="Date">{txn.date}</td>
                      <td data-label="Description">{txn.description}</td>
                      <td data-label="Category">
                        {txn.category ? (
                          <span
                            className="category-badge"
                            style={{
                              color: getCategoryColor(txn.category),
                              backgroundColor: `${getCategoryColor(txn.category)}33`
                            }}
                          >
                            {txn.category}
                          </span>
                        ) : '-'}
                      </td>
                      <td data-label="Amount" className={txn.amount >= 0 ? 'positive' : 'negative'}>
                        ${txn.amount.toFixed(2)}
                      </td>
                      <td data-label="Action">
                        <button
                          className="btn-delete-transaction"
                          onClick={() => handleDeleteTransaction(txn.id, txn.amount)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {showAddTxn && (
        <AddTransactionModal
          onClose={() => setShowAddTxn(false)}
          onSave={handleAddTransaction}
        />
      )}
    </div>
  );
};

export default OverviewContent;