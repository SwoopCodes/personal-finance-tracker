import React, { useState, useEffect, useCallback } from 'react';
import InvestmentsSidebar from './InvestmentsSidebar';
import StockOverview from './StockOverview';
import InvestmentSetupWizard from './InvestmentSetupWizard';
import AddInvestmentModal from './AddInvestmentModal';
import StatisticsPanel from './StatisticsPanel';
import '../FinanceOverview/FinanceExpanded.css';
import './InvestmentEmptyState.css';
import './StatisticsPanel.css';

const InvestmentExpanded = ({ onClose }) => {
  const [investments, setInvestments] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [hasHistory, setHasHistory] = useState(true);

  const fetchInvestments = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/investments', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch investments');
      const data = await res.json();
      setInvestments(data);
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  }, []);

  const fetchOnboardingStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/investments/onboarding-status', {
        credentials: 'include'
      });
      if (!res.ok) return true;
      const data = await res.json();
      const has = !!data.hasHistory;
      setHasHistory(has);
      return has;
    } catch (err) {
      return true;
    }
  }, []);

  const fetchAll = useCallback(async () => {
    const inv = await fetchInvestments();
    setSelectedTicker(prev => (prev && inv.some(p => p.ticker === prev) ? prev : (inv.length > 0 ? inv[0].ticker : null)));
  }, [fetchInvestments]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [inv] = await Promise.all([fetchInvestments(), fetchOnboardingStatus()]);
      if (inv.length > 0) setSelectedTicker(inv[0].ticker);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectTicker = (ticker) => {
    setSelectedTicker(ticker);
  };

  const handleWizardComplete = async () => {
    setShowWizard(false);
    setHasHistory(true);
    await fetchAll();
  };

  const handleAddSaved = async () => {
    setShowAddModal(false);
    await fetchAll();
  };

  const handlePositionClosed = async () => {
    await fetchAll();
  };

  if (loading) return <div className="expanded-overlay">Loading...</div>;
  if (error) return <div className="expanded-overlay">Error: {error}</div>;

  return (
    <div className="expanded-overlay">
      <div className="expanded-container">
        <div className="expanded-header">
          <div className="expanded-header-title">
            {hasHistory && (
              <button className="btn-statistics" onClick={() => setShowStats(true)}>
                📊 Statistics
              </button>
            )}
            <h2>Investment Portfolio</h2>
          </div>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>

        {showWizard ? (
          <InvestmentSetupWizard
            onComplete={handleWizardComplete}
            onCancel={() => setShowWizard(false)}
          />
        ) : !hasHistory ? (
          <div className="investment-empty-state">
            <div className="investment-empty-icon">📈</div>
            <h3>No investments yet</h3>
            <p>Set up your portfolio to start tracking real stock holdings.</p>
            <button className="btn-launch-wizard" onClick={() => setShowWizard(true)}>
              Set Up Investments
            </button>
          </div>
        ) : (
          <div className="expanded-body">
            <InvestmentsSidebar
              investments={investments}
              selectedTicker={selectedTicker}
              onSelect={selectTicker}
              onAdd={() => setShowAddModal(true)}
            />
            <StockOverview
              ticker={selectedTicker}
              onPositionClosed={handlePositionClosed}
            />
          </div>
        )}

        {showAddModal && (
          <AddInvestmentModal
            onClose={() => setShowAddModal(false)}
            onSaved={handleAddSaved}
          />
        )}
        {showStats && (
          <StatisticsPanel onClose={() => setShowStats(false)} />
        )}
      </div>
    </div>
  );
};

export default InvestmentExpanded;
