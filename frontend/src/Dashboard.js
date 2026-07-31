import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './Styles/Dashboard.css';
import { useTheme } from './ThemeContext';
import FinanceOverview from './Components/FinanceOverview';
import InvestmentPortfolio from './Components/InvestmentPortfolio';
import NetWorth from './Components/NetWorth';
import FinanceExpanded from './Components/FinanceOverview/FinanceExpanded';
import InvestmentExpanded from './Components/InvestmentPortfolio/InvestmentExpanded';
import NetWorthExpanded from './Components/NetWorth/NetWorthExpanded';

const Dashboard = () => {
  const [accountBalance, setAccountBalance] = useState(0);
  const [overviewChartData, setOverviewChartData] = useState([]);
  const [overviewIncome, setOverviewIncome] = useState(0);
  const [overviewExpense, setOverviewExpense] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financeExpanded, setFinanceExpanded] = useState(false);
  const [investmentExpanded, setInvestmentExpanded] = useState(false);
  const [netWorthExpanded, setNetWorthExpanded] = useState(false);
  const [investmentSummary, setInvestmentSummary] = useState({
    totalValue: 0, totalInvested: 0, totalPL: 0, totalPLPct: 0, chartData: []
  });
  const [netWorthSummary, setNetWorthSummary] = useState({
    netWorth: 0, cashValue: 0, investmentValue: 0, chartData: []
  });
  const nav = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const toggleFinanceExpanded = () => setFinanceExpanded(prev => !prev);

  const closeFinanceExpanded = () => {
    setFinanceExpanded(false);
    fetchDashboardSummary();
  };

  const toggleInvestmentExpanded = () => setInvestmentExpanded(prev => !prev);

  const closeInvestmentExpanded = () => {
    setInvestmentExpanded(false);
    fetchInvestmentSummary();
  };

  const toggleNetWorthExpanded = () => setNetWorthExpanded(prev => !prev);

  const closeNetWorthExpanded = () => {
    setNetWorthExpanded(false);
    fetchNetWorthSummary();
  };

  const fetchInvestmentSummary = useCallback(async () => {
    try {
      // /api/investments/stats includes realized P/L and dividend income on
      // top of the position aggregation /api/investments/summary provides,
      // which is what this dashboard tile needs.
      const response = await fetch('http://localhost:5000/api/investments/stats', {
        credentials: 'include'
      });
      if (response.status === 404) {
        setInvestmentSummary({ totalValue: 0, totalInvested: 0, totalPL: 0, totalPLPct: 0, chartData: [] });
        return;
      }
      if (!response.ok) return;
      const data = await response.json();
      setInvestmentSummary({
        totalValue: parseFloat(data.totalValue) || 0,
        totalInvested: parseFloat(data.totalInvested) || 0,
        totalPL: parseFloat(data.totalPL) || 0,
        totalPLPct: parseFloat(data.totalPLPct) || 0,
        chartData: (data.chartData || []).map(item => ({
          date: item.date,
          value: parseFloat(item.value) || 0
        }))
      });
    } catch (err) {
      // leave investment tile at defaults on failure
    }
  }, []);

  const fetchNetWorthSummary = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/networth/stats', {
        credentials: 'include'
      });
      if (!response.ok) return;
      const data = await response.json();
      setNetWorthSummary({
        netWorth: parseFloat(data.netWorth) || 0,
        cashValue: parseFloat(data.cashValue) || 0,
        investmentValue: parseFloat(data.investmentValue) || 0,
        chartData: (data.chartData || []).map(item => ({
          date: item.date,
          netWorth: parseFloat(item.netWorth) || 0
        }))
      });
    } catch (err) {
      // leave net worth tile at defaults on failure
    }
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:5000/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      // ignore network failure — still navigate away client-side
    }
    nav('/Login');
  };

  const fetchDashboardSummary = useCallback(async () => {
    try {
      const response = await fetch('http://localhost:5000/api/finance/dashboard-summary', {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          nav('/Login');
          return;
        }
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setAccountBalance(parseFloat(data.totalBalance) || 0);
      setOverviewChartData((data.chartData || []).map(item => ({
        date: item.date,
        income: parseFloat(item.income) || 0,
        expense: parseFloat(item.expense) || 0,
        balance: parseFloat(item.balance) || 0
      })));
      setOverviewIncome(parseFloat(data.totalIncome) || 0);
      setOverviewExpense(parseFloat(data.totalExpense) || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [nav]);

  useEffect(() => {
    fetchDashboardSummary();
    fetchInvestmentSummary();
    fetchNetWorthSummary();
  }, [fetchDashboardSummary, fetchInvestmentSummary, fetchNetWorthSummary]);

  if (loading) {
    return <div className="dashboard-container">Loading...</div>;
  }

  if (error) {
    return <div className="dashboard-container">Error: {error}</div>;
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-card">
        <header className="dashboard-header">
          <h1 className="dashboard-title">Dashboard</h1>
          <div className="dashboard-header-actions">
            <button
              className="btn-theme-toggle"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button className="btn btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <div className="dashboard-triangle">
          <div className="networth-tile-wrap">
            <NetWorth
              netWorth={netWorthSummary.netWorth}
              cashValue={netWorthSummary.cashValue}
              investmentValue={netWorthSummary.investmentValue}
              chartData={netWorthSummary.chartData}
              onExpand={toggleNetWorthExpanded}
            />
          </div>

          <section className="dashboard-grid">
            <FinanceOverview
              accountBalance={accountBalance}
              chartData={overviewChartData}
              totalIncome={overviewIncome}
              totalExpense={overviewExpense}
              onExpand={toggleFinanceExpanded}
            />

            <InvestmentPortfolio
              totalValue={investmentSummary.totalValue}
              totalInvested={investmentSummary.totalInvested}
              totalPL={investmentSummary.totalPL}
              totalPLPct={investmentSummary.totalPLPct}
              chartData={investmentSummary.chartData}
              onExpand={toggleInvestmentExpanded}
            />
          </section>
        </div>
        {financeExpanded && <FinanceExpanded onClose={closeFinanceExpanded} />}
        {investmentExpanded && <InvestmentExpanded onClose={closeInvestmentExpanded} />}
        {netWorthExpanded && <NetWorthExpanded onClose={closeNetWorthExpanded} />}
      </div>
    </div>
  );
};

export default Dashboard;