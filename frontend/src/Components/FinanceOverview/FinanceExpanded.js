import React, { useState, useEffect, useCallback } from 'react';
import AccountsSidebar from './AccountsSidebar';
import OverviewContent from './OverviewContent';
import CreateAccountWizard from '../CreateAccountWizard';
import './FinanceExpanded.css';
import '../InvestmentPortfolio/InvestmentEmptyState.css';

const FinanceExpanded = ({ onClose }) => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWizard, setShowWizard] = useState(false);
  const [hasHistory, setHasHistory] = useState(true);

  const fetchAccounts = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/accounts', {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch accounts');
      const data = await res.json();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      } else if (data.length > 0 && selectedAccountId) {
        // Keep selected account if it still exists
        const stillExists = data.some(a => a.id === selectedAccountId);
        if (!stillExists) {
          setSelectedAccountId(data[0].id);
        }
      }
      return data;
    } catch (err) {
      setError(err.message);
      return [];
    }
  };

  const fetchOnboardingStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/finance/onboarding-status', {
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

  // Fetch accounts + onboarding status on mount
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchAccounts(), fetchOnboardingStatus()]);
      setLoading(false);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWizardComplete = async () => {
    setShowWizard(false);
    setHasHistory(true);
    await fetchAccounts();
  };

  const handleAccountSelect = (accountId) => {
    setSelectedAccountId(accountId);
  };

  const handleAccountAdded = (newAccount) => {
    setAccounts(prev => [...prev, newAccount]);
    setSelectedAccountId(newAccount.id);
  };

  const handleAccountDeleted = (accountId) => {
    setAccounts(prev => prev.filter(acc => acc.id !== accountId));
    if (selectedAccountId === accountId) {
      const remaining = accounts.filter(acc => acc.id !== accountId);
      setSelectedAccountId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const refreshAccounts = async () => {
    await fetchAccounts();
  };

  if (loading) return <div className="expanded-overlay">Loading...</div>;
  if (error) return <div className="expanded-overlay">Error: {error}</div>;

  return (
    <div className="expanded-overlay">
      <div className="expanded-container">
        <div className="expanded-header">
          <h2>Finance Details</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        {showWizard ? (
          <CreateAccountWizard onAccountCreated={handleWizardComplete} />
        ) : !hasHistory ? (
          <div className="investment-empty-state">
            <div className="investment-empty-icon">💳</div>
            <h3>No accounts yet</h3>
            <p>Set up an account to start tracking your finances.</p>
            <button className="btn-launch-wizard" onClick={() => setShowWizard(true)}>
              Set Up Accounts
            </button>
          </div>
        ) : (
          <div className="expanded-body">
            <AccountsSidebar
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onSelect={handleAccountSelect}
              onAccountAdded={handleAccountAdded}
              onAccountDeleted={handleAccountDeleted}
            />
            <OverviewContent
              accountId={selectedAccountId}
              accounts={accounts}
              onTransactionAdded={() => {}}
              onUpdateAccountBalance={() => {}} // no longer used
              refreshAccounts={refreshAccounts}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceExpanded;