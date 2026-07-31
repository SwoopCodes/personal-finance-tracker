import React, { useState } from 'react';
import AddAccountModal from './AddAccountModal';
import './AccountsSidebar.css';

const AccountsSidebar = ({ accounts, selectedAccountId, onSelect, onAccountAdded, onAccountDeleted }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const handleAddAccount = async (accountName, balance) => {
    try {
      const res = await fetch('http://localhost:5000/api/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ account_name: accountName, balance })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create account');
      }
      const newAccount = await res.json();  // now contains id, name, balance
      onAccountAdded(newAccount);
      setShowAddModal(false);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteAccount = async (accountId) => {
    if (!window.confirm('Delete this account and all its transactions?')) return;
    try {
      const res = await fetch(`http://localhost:5000/api/accounts/${accountId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete account');
      }
      onAccountDeleted(accountId);
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleEditMode = () => setEditMode(prev => !prev);

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>Accounts</h3>
        <div className="sidebar-actions">
          <button className="btn-edit-toggle" onClick={toggleEditMode}>
            {editMode ? 'Done' : '✎'}
          </button>
          <button className="btn-add-account" onClick={() => setShowAddModal(true)}>+</button>
        </div>
      </div>
      <ul className="account-list">
        {accounts.map(acc => (
          <li
            key={acc.id}
            className={`account-item ${selectedAccountId === acc.id ? 'active' : ''}`}
          >
            <span className="account-info" onClick={() => onSelect(acc.id)}>
              <span className="account-icon" aria-hidden="true">💳</span>
              <span className="account-name">{acc.name}</span>
            </span>
            <span className="account-balance">${acc.balance.toFixed(2)}</span>
            {editMode && (
              <button
                className="btn-delete-account"
                onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc.id); }}
              >
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {showAddModal && (
        <AddAccountModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddAccount}
        />
      )}
    </div>
  );
};

export default AccountsSidebar;