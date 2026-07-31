import React, { useState, useEffect, useCallback } from 'react';
import TotalNetWorthPanel from './TotalNetWorthPanel';
import PersonalFinancePanel from './PersonalFinancePanel';
import InvestmentContributionPanel from './InvestmentContributionPanel';
import '../FinanceOverview/FinanceExpanded.css';
import '../InvestmentPortfolio/StatisticsPanel.css';
import '../InvestmentPortfolio/StockOverview.css';
import './NetWorthExpanded.css';

const NetWorthExpanded = ({ onClose }) => {
  const [view, setView] = useState('total');
  const [timeframe, setTimeframe] = useState('1m');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`http://localhost:5000/api/networth/stats?timeframe=${timeframe}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to load net worth statistics');
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

  return (
    <div className="expanded-overlay">
      <div className="expanded-container">
        <div className="expanded-header">
          <div className="networth-nav">
            <button
              className={`networth-nav-btn ${view === 'finance' ? 'active' : ''}`}
              onClick={() => setView('finance')}
            >
              Personal Finance
            </button>
            <button
              className={`networth-nav-btn ${view === 'total' ? 'active' : ''}`}
              onClick={() => setView('total')}
            >
              Total Net Worth
            </button>
            <button
              className={`networth-nav-btn ${view === 'investments' ? 'active' : ''}`}
              onClick={() => setView('investments')}
            >
              Investment Portfolio
            </button>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        <div className="expanded-body networth-body">
          {loading && <p>Loading...</p>}
          {error && <p className="error-message">{error}</p>}
          {data && !loading && (
            view === 'total' ? (
              <TotalNetWorthPanel data={data} timeframe={timeframe} onTimeframeChange={setTimeframe} />
            ) : view === 'finance' ? (
              <PersonalFinancePanel data={data} />
            ) : (
              <InvestmentContributionPanel data={data} />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default NetWorthExpanded;
