import React, { useState } from 'react';
import './Modal.css';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories';

const AddTransactionModal = ({ onClose, onSave }) => {
  const [type, setType] = useState('expense');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const categoryOptions = type === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  const handleTypeChange = (newType) => {
    setType(newType);
    setCategory('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!description.trim() || isNaN(amt) || amt <= 0) {
      alert('Please enter a valid description and positive amount.');
      return;
    }
    if (!category) {
      alert('Please select a category.');
      return;
    }
    setLoading(true);
    try {
      await onSave(type, description.trim(), amt, category);
    } catch (err) {
      // error handled in parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Add Transaction</h3>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Type</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="expense"
                  checked={type === 'expense'}
                  onChange={() => handleTypeChange('expense')}
                /> Expense
              </label>
              <label>
                <input
                  type="radio"
                  value="income"
                  checked={type === 'income'}
                  onChange={() => handleTypeChange('income')}
                /> Income
              </label>
            </div>
          </div>
          <div className="input-group">
            <label>Category</label>
            <select
              className="category-select"
              value={category}
              onChange={e => setCategory(e.target.value)}
              required
            >
              <option value="" disabled>Select a category</option>
              {categoryOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="input-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g., Grocery shopping"
              required
              autoFocus
            />
          </div>
          <div className="input-group">
            <label>Amount ($)</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="2147483647"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="25.50"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-register" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-login" disabled={loading}>
              {loading ? 'Saving...' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;