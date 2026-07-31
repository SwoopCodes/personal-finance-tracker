import React, { useState } from 'react';
import './Modal.css';

const AddAccountModal = ({ onClose, onSave }) => {
  const [accountName, setAccountName] = useState('');
  const [balance, setBalance] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const bal = parseFloat(balance);
    if (!accountName.trim() || isNaN(bal) || bal < 0) {
      alert('Please enter a valid account name and balance.');
      return;
    }
    setLoading(true);
    try {
      await onSave(accountName.trim(), bal);
    } catch (err) {
      // error already handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Add New Account</h3>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Account Name</label>
            <input
              type="text"
              value={accountName}
              onChange={e => setAccountName(e.target.value)}
              placeholder="e.g., Savings"
              required
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Starting Balance</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="2147483647"
              value={balance}
              onChange={e => setBalance(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-register" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-login" disabled={loading}>
              {loading ? 'Creating...' : 'Add Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddAccountModal;