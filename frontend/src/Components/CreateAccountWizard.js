import React, { useState } from 'react';
import '../Styles/Dashboard.css'; // reuse dashboard styles
import './CreateAccountWizard.css';

const CreateAccountWizard = ({ onAccountCreated }) => {
  const [step, setStep] = useState(1);
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = (e) => {
    e.preventDefault();
    if (accountName.trim() === '') {
      setError('Please enter an account name.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const balanceNum = parseFloat(balance);
    if (isNaN(balanceNum) || balanceNum < 0) {
      setError('Please enter a valid positive balance.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          account_name: accountName.trim(),
          balance: balanceNum
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account');
      }

      // Success: notify parent to refresh dashboard
      onAccountCreated(balanceNum);

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="account-wizard">
      <h2 className="account-wizard-title">
        Welcome! Let's set up your account
      </h2>

      {error && (
        <div className="wizard-error" style={{ textAlign: 'center' }}>
          {error}
        </div>
      )}

        <form onSubmit={step === 1 ? handleNext : handleSubmit}>
          {step === 1 && (
            <div className="input-group">
              <label className="input-label">Account Name</label>
              <input
                type="text"
                className="login-input" // reuse login input styling
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Main Checking"
                required
                autoFocus
              />
            </div>
          )}

          {step === 2 && (
            <div className="input-group">
              <label className="input-label">Starting Balance</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="login-input"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
              />
            </div>
          )}

          <div className="button-group" style={{ marginTop: '2rem' }}>
            {step === 1 && (
              <button type="button" className="btn btn-login" onClick={handleNext}>
                Next →
              </button>
            )}

            {step === 2 && (
              <>
                <button type="button" className="btn btn-register" onClick={handleBack}>
                  ← Back
                </button>
                <button type="submit" className="btn btn-login" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </>
            )}
          </div>
        </form>

      <p className="account-wizard-step" style={{ textAlign: 'center' }}>
        Step {step} of 2
      </p>
    </div>
  );
};

export default CreateAccountWizard;